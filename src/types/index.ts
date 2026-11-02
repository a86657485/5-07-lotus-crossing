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
  }[];
}

export interface StudentSessionRecord {
  student: Student;
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
  examResult?: ExamEvaluationResult;
  examAnswers?: Record<string, any>;
  rewardUnlocked: boolean;
}
