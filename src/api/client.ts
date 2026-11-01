import { ExamEvaluationResult, Student, StudentSessionRecord } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
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
};

export async function apiLogin(input: {
  classId: string;
  studentId?: string;
  name?: string;
}): Promise<{ student: Student; state: ServerState }> {
  return request('/api/login', { method: 'POST', body: JSON.stringify(input) });
}

export async function apiGetState(studentId: string): Promise<{ student: Student; state: ServerState }> {
  return request(`/api/state?studentId=${encodeURIComponent(studentId)}`);
}

export async function apiSaveProgress(
  studentId: string,
  patch: Partial<ServerState>
): Promise<{ student: Student; state: ServerState }> {
  return request('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ studentId, ...patch }),
  });
}

export async function apiUseRelic(studentId: string): Promise<{ student: Student; state: ServerState }> {
  return request('/api/relic', {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export async function apiSubmitExam(
  studentId: string,
  answers: Record<string, any>
): Promise<{ student: Student; state: ServerState; result: ExamEvaluationResult }> {
  return request('/api/exam/submit', {
    method: 'POST',
    body: JSON.stringify({ studentId, answers, eventId: crypto.randomUUID() }),
  });
}

export type TeacherPayload = {
  denominator: number;
  classCounts: Record<string, number>;
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
  }>;
  updatedAt: string;
};

export async function apiTeacher(classId?: string): Promise<TeacherPayload> {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return request(`/api/teacher${q}`);
}

export function teacherExportUrl(classId?: string): string {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return `${API_BASE}/api/teacher/export.csv${q}`;
}
