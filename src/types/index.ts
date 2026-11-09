export type ClassId = '501' | '502' | '503' | '504';

export interface Student {
  studentId: string; // `${classId}|${name}|${rosterIndex}`
  classId: ClassId;
  name: string;
  rosterIndex: number;
  rosterSource: 'roster' | 'manual';
  isTest: boolean;
}

export type TaskId =
  | 's1_order'
  | 's2_rewrite'
  | 's2_vs_branch'
  | 's2_kettle'
  | 's3_timing'
  | 'exam';

export type GateState = 'pre_missing' | 'pre_done_unverified' | 'verified_ready';

export interface RelicState {
  quota: number; // fixed 3
  used: number;
  remaining: number;
  unlockedRelics: {
    whistle: boolean; // S1 斑马线哨
    arrow: boolean;   // S2 回边箭头
    knob: boolean;    // S3 时长旋钮
  };
}

export interface StationProgress {
  s1_order: boolean;
  s2_rewrite: boolean;
  s2_vs_branch: boolean;
  s2_kettle: boolean;
  s3_timing: boolean;
  exam: boolean;
}

export interface S3State {
  faultObserved: boolean;
  scenario: 'car_heavy' | 'pedestrian_heavy' | 'rain_weather';
  strategy: string;
  reason: string;
  ruleChanged: boolean;
  revalidateOk: boolean;
}

export interface LearningEvidence {
  eventId: string;
  taskId: TaskId | 'intro';
  eventType: 'attempt' | 'evidence_attempt' | 'case_run' | 'scenario_run' | 'simulation_run' | 'evidence_lock' | 'station_reset' | 'current_invalidated';
  correct?: boolean | null;
  payload?: Record<string, unknown>;
  clientTs?: string | null;
  s3Detail?: S3State | null;
  attemptKind?: 'first' | 'revision' | 'process' | 'confirmation' | 'unknown';
  receivedAt?: string;
}

export interface QuestionClient {
  id: string;
  tier: 'base' | 'challenge';
  type: string;
  stem: string;
  prompt?: string;
  options?: string[];
  cards?: string[];
  rows?: { prompt: string; choices: string[] }[];
  interaction?: string;
  diagramRef?: string;
  platform?: string;
  fixedBlocks?: string[];
  blockMeta?: { label: string; category: string; verifiedName?: boolean }[];
  pureText?: boolean;
}

export interface QuestionServer extends QuestionClient {
  goalIds: string[];
  keyIds: string[];
  difficultyIds: string[];
  solo: string;
  literacy: string;
  misconceptionMap: Record<string, string>;
  analysis: string;
  relatedTaskId?: string;
  reverseDebug?: boolean;
  counterexample?: boolean;
}

export interface ExamEvaluationResult {
  baseScore: number;
  baseTotal: number;
  g1Score: number;
  g1Total: number;
  g2Score: number;
  g2Total: number;
  passed: boolean;
  challengeScore?: number;
  challengeTotal?: number;
  challengePassed?: boolean;
  details: {
    questionId: string;
    correct: boolean;
    tier: 'base' | 'challenge';
    misconceptionId?: string;
    misconceptionIds?: string[];
  }[];
}

export type ExamAnswer = string | Record<string, string>;
export interface ExamReviewItem {
  questionId: string;
  correct: boolean;
  submittedAnswer: ExamAnswer;
  correctAnswer: ExamAnswer;
  analysis: string;
  relatedTaskId?: string;
}

export interface StudentSessionRecord {
  student: Student;
  stateVersion?: number;
  startedAt: string;
  lastActiveAt: string;
  stations: StationProgress;
  s3Detail: S3State;
  relics: RelicState;
  scaffoldHistory: {
    taskId: TaskId;
    level: 1 | 2 | 3;
    misconceptionId?: string;
    ts: string;
  }[];
  evidenceHistory?: LearningEvidence[];
  priorEvidenceUnknown?: boolean;
  examResult?: ExamEvaluationResult;
  examFirstResult?: ExamEvaluationResult | null;
  challengeFirstResult?: ExamEvaluationResult | null;
  examLatestResult?: ExamEvaluationResult | null;
  examFirstAnswers?: Record<string, any> | null;
  challengeFirstAnswers?: Record<string, any> | null;
  examAnswers?: Record<string, any>;
  examFeedback?: Partial<Record<'base' | 'challenge', ExamReviewItem[]>>;
  legacyIncompleteExam?: Partial<Record<'base' | 'challenge', {
    result: ExamEvaluationResult;
    answers: Record<string, ExamAnswer> | null;
    archivedAt: string;
  }>>;
  rewardUnlocked: boolean;
}
