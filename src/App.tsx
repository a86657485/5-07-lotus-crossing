import React, { useState, useEffect, useCallback } from 'react';
import { LoginView } from './components/views/LoginView';
import { ExamView } from './components/views/ExamView';
import { RewardLoopGame } from './components/views/RewardLoopGame';
import { TeacherDashboardView } from './components/views/TeacherDashboardView';
import { GodotPlayView } from './components/views/GodotPlayView';
import {
  ExamEvaluationResult,
  RelicState,
  S3State,
  StationProgress,
  Student,
  TaskId,
} from './types';
import { apiLogin, apiSaveProgress, apiUseRelic, ServerState } from './api/client';

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

  const persist = useCallback(
    async (patch: Partial<ServerState>) => {
      if (!currentStudent) return;
      try {
        const res = await apiSaveProgress(currentStudent.studentId, patch);
        setCurrentSession(res.state);
        setSyncError('');
      } catch (err: any) {
        setSyncError(err?.message || '进度同步失败');
      }
    },
    [currentStudent]
  );

  const currentProgress: StationProgress = currentSession?.stations || emptyStations();
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
      setCurrentSession(res.state);
      // 主玩法改走 Godot HTML5（导入可跳过在引擎内）
      setCurrentView('godot');
    } catch (err: any) {
      setSyncError(err?.message || '登录失败，请确认课堂服务已启动');
    }
  };

  const handleUseRelic = async () => {
    if (!currentStudent) return;
    try {
      const res = await apiUseRelic(currentStudent.studentId);
      setCurrentSession(res.state);
       (window as any).G5L7Classroom?.emit?.('relic:sync', {
        remaining: res.state.relics?.remaining ?? 0,
      });
    } catch (err: any) {
      setSyncError(err?.message || '法宝使用失败');
    }
  };

  const handleEvidence = (envelope: any) => {
    if (!currentStudent || !currentSession) return;
    const taskId = envelope?.taskId as TaskId | string;
    const nextStations = { ...currentSession.stations };
    const nextRelics = { ...currentSession.relics, unlockedRelics: { ...currentSession.relics.unlockedRelics } };
    let nextS3 = currentSession.s3Detail;

    if (taskId === 's1_order' && envelope?.correct) {
      nextStations.s1_order = true;
      nextRelics.unlockedRelics.whistle = true;
    }
    if (taskId === 's2_rewrite' && envelope?.correct) nextStations.s2_rewrite = true;
    if (taskId === 's2_vs_branch' && envelope?.correct) nextStations.s2_vs_branch = true;
    if (taskId === 's2_kettle' && envelope?.correct) {
      nextStations.s2_kettle = true;
      nextRelics.unlockedRelics.arrow = true;
    }
    if (taskId === 's3_timing' && envelope?.correct) {
      nextStations.s3_timing = true;
      nextRelics.unlockedRelics.knob = true;
      if (envelope?.s3Detail) nextS3 = envelope.s3Detail;
      else if (envelope?.payload) {
        nextS3 = {
          ...nextS3,
          faultObserved: !!envelope.payload.faultObserved,
          strategy: envelope.payload.strategyId || nextS3.strategy,
          reason: envelope.payload.reasonId || nextS3.reason,
          ruleChanged: true,
          revalidateOk: !!envelope.payload.revalidateOk,
        };
      }
    }

    const patch: Partial<ServerState> = { stations: nextStations, relics: nextRelics, s3Detail: nextS3 };
    setCurrentSession({ ...currentSession, ...patch });
    void persist(patch);
  };

  const handleExamComplete = (result: ExamEvaluationResult, _answers: Record<string, any>) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      stations: { ...currentSession.stations, exam: true },
      examResult: result,
      rewardUnlocked: result.passed,
    });
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
          onEvidence={handleEvidence}
          onExamOpen={() => setCurrentView('exam')}
          onRelicUse={() => void handleUseRelic()}
          onS3Detail={detail => {
            if (!currentSession) return;
            setCurrentSession({ ...currentSession, s3Detail: detail });
            void persist({ s3Detail: detail });
          }}
        />
      )}

      {currentView === 'exam' && currentStudent && (
        <ExamView
          studentId={currentStudent.studentId}
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
