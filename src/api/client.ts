import { ClassId, ExamEvaluationResult, LearningEvidence, Student, StudentSessionRecord } from '../types';
import { makeEventId } from '../utils/eventId';
import { TRAIN_LAP_LIMIT, TRAIN_ORDERS, type TrainResultInput } from '../lesson/trainReward';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
// A token belongs to this tab's selected student; shared preview storage is not used.
let sessionToken = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export type ServerState = StudentSessionRecord & {
  examOpen?: boolean;
  examPaused?: boolean;
  challengeFirstResult?: ExamEvaluationResult | null;
};

export type StationEvidence = {
  taskId: string;
  correct?: boolean;
  s3Detail?: ServerState['s3Detail'];
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProgressPatch = Omit<Partial<ServerState>, 'stations'> & {
  stations?: Partial<ServerState['stations']>;
  evidence?: StationEvidence;
};

export async function apiLogin(input: {
  classId: string;
  studentId?: string;
  name?: string;
}): Promise<{ student: Student; state: ServerState }> {
  const result = await request<{ student: Student; state: ServerState; sessionToken: string }>(
    '/api/login', { method: 'POST', body: JSON.stringify(input) }
  );
  sessionToken = result.sessionToken;
  return result;
}

export async function apiGetState(studentId: string): Promise<{ student: Student; state: ServerState }> {
  return request(`/api/state?studentId=${encodeURIComponent(studentId)}`);
}

export type RosterClass = { id: ClassId; students: Array<{ id: string; name: string }> };

export function apiRoster(): Promise<{ classes: RosterClass[] }> {
  return request('/api/roster');
}

export async function apiSaveProgress(
  studentId: string,
  patch: ProgressPatch
): Promise<{ student: Student; state: ServerState }> {
  return request('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ studentId, ...patch }),
  });
}

export async function apiUseRelic(studentId: string, eventId = makeEventId('relic')): Promise<{ student: Student; state: ServerState }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await request('/api/relic', {
      method: 'POST',
      body: JSON.stringify({ studentId, eventId }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiReportEvidence(
  studentId: string,
  evidence: LearningEvidence
): Promise<{ student: Student; state: ServerState }> {
  return request('/api/evidence', {
    method: 'POST',
    body: JSON.stringify({ studentId, evidence }),
  });
}

export async function apiSubmitExam(
  studentId: string,
  answers: Record<string, any>,
  tier: 'base' | 'challenge' = 'base'
): Promise<{ student: Student; state: ServerState; result: ExamEvaluationResult }> {
  const eventId = makeEventId('exam');
  return request('/api/exam/submit', {
    method: 'POST',
    body: JSON.stringify({ studentId, answers, eventId, tier }),
  });
}

function trainRewardKey(studentId: string, orderIndex: number) {
  return `g5l7.trainResult.v1.${studentId}.${orderIndex}`;
}

function readPendingTrainReward(key: string, orderIndex: number): TrainResultInput | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value?.orderIndex !== orderIndex || (value.rule !== 'three' && value.rule !== 'fulfilled') ||
        !Array.isArray(value.route) || !value.route.length || value.route.length > TRAIN_LAP_LIMIT ||
        value.route.some((lane: unknown) => lane !== 'water' && lane !== 'tools')) return null;
    return value;
  } catch {
    return null;
  }
}

export async function apiRecordTrainReward(studentId: string, submission: TrainResultInput): Promise<{ bestLaps: number }> {
  const { orderIndex } = submission;
  const key = trainRewardKey(studentId, orderIndex);
  const pending = readPendingTrainReward(key, orderIndex);
  const usePending = pending && pending.route.length <= submission.route.length;
  const { rule, route } = usePending ? pending : submission;
  if (!usePending) {
    try { localStorage.setItem(key, JSON.stringify(submission)); } catch { /* Try the server without a local copy. */ }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const result = await request<{ bestLaps: number }>('/api/reward/train/result', {
      method: 'POST',
      body: JSON.stringify({ studentId, orderIndex, rule, route }),
      keepalive: true,
      signal: controller.signal,
    });
    const remaining = readPendingTrainReward(key, orderIndex);
    if (remaining && result.bestLaps <= remaining.route.length) {
      try { localStorage.removeItem(key); } catch { /* Sending the same result again is safe. */ }
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function retryPendingTrainRewards(studentId: string) {
  const requests = TRAIN_ORDERS.flatMap((_, index) => {
    const pending = readPendingTrainReward(trainRewardKey(studentId, index), index);
    return pending ? [apiRecordTrainReward(studentId, pending)] : [];
  });
  return Promise.allSettled(requests);
}

export type TeacherPayload = {
  canManageExam: boolean;
  examPauses: Record<string, boolean>;
  denominator: number;
  classCounts: Record<string, number>;
  rewardLeaderboard: Array<{
    studentId: string;
    name: string;
    classId: string;
    completedOrders: number;
    totalExtraLaps: number;
    orders: Array<{ orderIndex: number; bestLaps: number }>;
  }>;
  summary: {
    total: number;
    entered: number;
    notEntered: number;
    s1: number;
    s2: number;
    s3: number;
    examPassed: number;
    challengeBonus: number;
    relicUsed: number;
  };
  students: Array<{
    student: Student;
    entered: boolean;
    lastSync: string | null;
    stations: StudentSessionRecord['stations'];
    relics: StudentSessionRecord['relics'];
    examResult?: ExamEvaluationResult | null;
    rewardUnlocked: boolean;
    examOpen: boolean;
    s3Detail: StudentSessionRecord['s3Detail'];
    evidence?: LearningEvidence[];
    evidenceHistory?: LearningEvidence[];
    priorEvidenceUnknown?: boolean;
    examFirstResult?: ExamEvaluationResult | null;
    challengeFirstResult?: ExamEvaluationResult | null;
    examLatestResult?: ExamEvaluationResult | null;
    examFirstComplete: boolean;
    challengeFirstComplete: boolean;
    examLatestComplete: boolean;
    incompleteScores?: { base?: number; challenge?: number };
    examFirstAnswers?: Record<string, unknown> | null;
    challengeFirstAnswers?: Record<string, unknown> | null;
    examAnswers?: Record<string, unknown> | null;
  }>;
  updatedAt: string;
};

export async function apiTeacher(classId?: string): Promise<TeacherPayload> {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return request(`/api/teacher${q}`);
}

export async function apiSetClassExamPaused(classId: string, closed: boolean): Promise<{ classId: string; closed: boolean }> {
  return request('/api/teacher/exam-close', {
    method: 'POST',
    body: JSON.stringify({ classId, closed }),
  });
}

export function teacherExportUrl(classId?: string): string {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return `${API_BASE}/api/teacher/export.csv${q}`;
}
