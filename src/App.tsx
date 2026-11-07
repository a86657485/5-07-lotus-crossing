import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoginView } from './components/views/LoginView';
import { ExamView } from './components/views/ExamView';
import { RewardLoopGame } from './components/views/RewardLoopGame';
import { TeacherDashboardView } from './components/views/TeacherDashboardView';
import { GodotPlayView } from './components/views/GodotPlayView';
import {
  ExamEvaluationResult,
  LearningEvidence,
  RelicState,
  S3State,
  StationProgress,
  Student,
} from './types';
import { apiLogin, apiGetState, apiReportEvidence, apiSaveProgress, apiUseRelic, ProgressPatch, ServerState } from './api/client';
import { createSyncQueue } from './utils/progressSync';
import { mergePendingEvidence, progressWithPendingEdits } from './utils/pendingEvidence';
import { makeEventId } from './utils/eventId';

type PendingEvidence = { studentId: string; evidence: LearningEvidence };
const PENDING_EVIDENCE_KEY = 'g5l7.pendingEvidence.v1';

function readPendingEvidence(): PendingEvidence[] {
  try {
    const data = JSON.parse(window.localStorage.getItem(PENDING_EVIDENCE_KEY) || '[]');
    return Array.isArray(data) ? data.filter(item =>
      item && typeof item.studentId === 'string' && typeof item.evidence?.eventId === 'string'
    ) : [];
  } catch {
    return [];
  }
}

function savePendingEvidence(items: PendingEvidence[]): boolean {
  try {
    if (items.length) window.localStorage.setItem(PENDING_EVIDENCE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(PENDING_EVIDENCE_KEY);
    return true;
  } catch {
    return false;
  }
}

function emptyStations(): StationProgress {
  return {
    s1_order: false,
    s2_rewrite: false,
    s2_vs_branch: false,
    s2_kettle: false,
    s3_timing: false,
    exam: false,
  };
}

function emptyRelics(): RelicState {
  return {
    quota: 3,
    used: 0,
    remaining: 3,
    unlockedRelics: { whistle: false, arrow: false, knob: false },
  };
}

function emptyS3(): S3State {
  return {
    faultObserved: false,
    scenario: 'car_heavy',
    strategy: '',
    reason: '',
    ruleChanged: false,
    revalidateOk: false,
  };
}

export default function App() {
  const [isTeacherRoute, setIsTeacherRoute] = useState(
    window.location.pathname === '/teacher' || window.location.hash === '#teacher'
  );

  useEffect(() => {
    const handlePopState = () => {
      setIsTeacherRoute(window.location.pathname === '/teacher' || window.location.hash === '#teacher');
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentSession, setCurrentSession] = useState<ServerState | null>(null);
  const [syncError, setSyncError] = useState('');
  const [currentView, setCurrentView] = useState<'login' | 'godot' | 'exam' | 'reward_game'>('login');
  const pendingEvidence = useRef<PendingEvidence[]>(readPendingEvidence());
  const evidenceDrain = useRef<Promise<void> | null>(null);
  const retryTimer = useRef<number | null>(null);
  const examRequested = useRef(false);
  const activeStudent = useRef<string | null>(null);
  const sessionId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const syncQueue = useRef(createSyncQueue());
  activeStudent.current = currentStudent?.studentId || null;

  const acceptServerState = useCallback((studentId: string, state: ServerState) => {
    if (activeStudent.current !== studentId) return;
    setCurrentSession(previous => previous?.student.studentId === studentId &&
      (previous.stateVersion || 0) > (state.stateVersion || 0) ? previous : state);
  }, []);

  const flushEvidence = useCallback((): Promise<void> => {
    if (evidenceDrain.current) return evidenceDrain.current;
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    const work = (async () => {
      while (activeStudent.current) {
        const index = pendingEvidence.current.findIndex(item => item.studentId === activeStudent.current);
        if (index < 0) break;
        const item = pendingEvidence.current[index];
        const res = await syncQueue.current(() => apiReportEvidence(item.studentId, item.evidence));
        pendingEvidence.current.splice(index, 1);
        if (!savePendingEvidence(pendingEvidence.current)) {
          setSyncError('本机暂存不可用，请保持页面打开直到同步完成');
        }
        if (activeStudent.current === item.studentId) {
          acceptServerState(item.studentId, res.state);
          setSyncError('');
          if (examRequested.current && res.state.examOpen) {
            examRequested.current = false;
            setCurrentView('exam');
          }
        }
      }
    })().catch((err: Error) => {
      const message = /Failed to fetch|fetch failed|NetworkError/i.test(err?.message || '') ? '暂时连不上课堂服务' : err?.message || '学习记录同步失败';
      setSyncError(`${message}，正在自动重试`);
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        void flushEvidence();
      }, 3000);
    }).finally(() => { evidenceDrain.current = null; });
    evidenceDrain.current = work;
    return work;
  }, [acceptServerState]);

  useEffect(() => {
    const retry = () => { void flushEvidence(); };
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('online', retry);
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    };
  }, [flushEvidence]);

  useEffect(() => {
    if (!currentStudent) return;
    if (pendingEvidence.current.some(item => item.studentId === currentStudent.studentId && item.evidence.taskId === 's3_timing' && item.evidence.eventType === 'evidence_lock' && item.evidence.correct === true)) {
      examRequested.current = true;
    }
    void flushEvidence();
  }, [currentStudent, flushEvidence]);

  const persist = useCallback(
    async (patch: ProgressPatch) => {
      if (!currentStudent) return;
      try {
        const res = await syncQueue.current(() => apiSaveProgress(currentStudent.studentId, patch));
        acceptServerState(currentStudent.studentId, res.state);
        if (!pendingEvidence.current.some(item => item.studentId === currentStudent.studentId)) setSyncError('');
      } catch (err: any) {
        setSyncError(err?.message || '进度同步失败');
      }
    },
    [currentStudent, acceptServerState]
  );

  const studentPending = pendingEvidence.current.filter(item => item.studentId === currentStudent?.studentId).map(item => item.evidence);
  const currentEvidence = mergePendingEvidence(currentSession?.evidenceHistory, studentPending);
  const currentProgress = progressWithPendingEdits(currentSession?.stations || emptyStations(), studentPending);
  const currentRelics: RelicState = currentSession?.relics || emptyRelics();
  const currentS3State: S3State = currentSession?.s3Detail || emptyS3();

  const handleLogin = async (student: Student) => {
    setSyncError('');
    try {
      const res = await apiLogin({
        classId: student.classId,
        studentId: student.rosterSource === 'roster' ? student.studentId : undefined,
        name: student.name,
      });
      setCurrentStudent(res.student);
      activeStudent.current = res.student.studentId;
      setCurrentSession(res.state);
      examRequested.current = false;
      // 主玩法改走 Godot HTML5（导入可跳过在引擎内）
      setCurrentView('godot');
    } catch (err: any) {
      setSyncError(err?.message || '登录失败，请确认课堂服务已启动');
    }
  };

  const handleUseRelic = async () => {
    if (!currentStudent) return;
    try {
      const res = await syncQueue.current(() => apiUseRelic(currentStudent.studentId));
      acceptServerState(currentStudent.studentId, res.state);
       (window as any).G5L7Classroom?.emit?.('relic:sync', {
        remaining: res.state.relics?.remaining ?? 0,
      });
    } catch (err: any) {
      setSyncError(err?.message || '法宝使用失败');
    }
  };

  const handleEvidence = (envelope: any) => {
    if (!currentStudent || !envelope?.taskId || !envelope?.eventType) return;
    const evidence: LearningEvidence = {
      ...envelope,
      eventId: envelope.eventId ? `${sessionId.current}-${String(envelope.eventId)}` : makeEventId('evidence'),
    };
    pendingEvidence.current.push({ studentId: currentStudent.studentId, evidence });
    if (!savePendingEvidence(pendingEvidence.current)) {
      setSyncError('本机暂存不可用，请保持页面打开直到同步完成');
    }
    void flushEvidence();
  };

  const handleExamComplete = (_result: ExamEvaluationResult, _answers: Record<string, any>, state: ServerState) => {
    if (!currentStudent) return;
    acceptServerState(currentStudent.studentId, state);
  };

  const handleOpenExam = async () => {
    if (!currentStudent) return;
    examRequested.current = true;
    await flushEvidence();
    if (pendingEvidence.current.some(item => item.studentId === currentStudent.studentId)) return;
    try {
      const res = await syncQueue.current(() => apiGetState(currentStudent.studentId));
      acceptServerState(currentStudent.studentId, res.state);
      if (!res.state.examOpen) throw new Error('请先完成三个探究站并同步进度');
      examRequested.current = false;
      setCurrentView('exam');
    } catch (err: any) {
      setSyncError(err?.message || '开考核验失败，请重试');
    }
  };

  if (isTeacherRoute) {
    return (
      <TeacherDashboardView
        onBackToApp={() => {
          window.location.hash = '';
          window.history.pushState({}, '', '/');
          setIsTeacherRoute(false);
        }}
      />
    );
  }

  if (!currentStudent || currentView === 'login') {
    return (
      <div className="relative">
        <LoginView onLogin={handleLogin} />
        {syncError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
            {syncError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950">
      {syncError && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow z-50">
          {syncError}
        </div>
      )}

      {currentView === 'godot' && (
        <GodotPlayView
          student={currentStudent}
          progress={currentProgress}
          relics={currentRelics}
          s3State={currentS3State}
          evidenceHistory={currentEvidence}
          examOpen={currentSession?.examOpen}
          onEvidence={handleEvidence}
          onExamOpen={() => void handleOpenExam()}
          onRelicUse={() => void handleUseRelic()}
          onS3Detail={detail => {
            if (!currentSession) return;
            setCurrentSession(previous => previous ? { ...previous, s3Detail: detail } : previous);
            void persist({ s3Detail: detail });
          }}
        />
      )}

      {currentView === 'exam' && currentStudent && (
        <ExamView
          studentId={currentStudent.studentId}
          initialAnswers={currentSession?.examAnswers || undefined}
          initialResult={currentSession?.examResult || undefined}
          initialLatestResult={currentSession?.examLatestResult || undefined}
          initialChallengeSubmitted={!!currentSession?.challengeFirstResult}
          onExamComplete={handleExamComplete}
          onOpenRewardGame={() => setCurrentView('reward_game')}
          onBackToMap={() => setCurrentView('godot')}
        />
      )}

      {currentView === 'reward_game' && (
        <RewardLoopGame onBackToMap={() => setCurrentView('godot')} />
      )}
    </div>
  );
}
