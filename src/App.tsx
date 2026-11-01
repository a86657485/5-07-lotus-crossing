import React, { useState, useEffect, useCallback } from 'react';
import { LoginView } from './components/views/LoginView';
import { IntroStoryModal } from './components/views/IntroStoryModal';
import { MainIntersectionMap } from './components/views/MainIntersectionMap';
import { Station1CrosswalkView } from './components/views/Station1CrosswalkView';
import { Station2LoopAnalysisView } from './components/views/Station2LoopAnalysisView';
import { Station3TimingDispatchView } from './components/views/Station3TimingDispatchView';
import { ExamView } from './components/views/ExamView';
import { RewardLoopGame } from './components/views/RewardLoopGame';
import { TeacherDashboardView } from './components/views/TeacherDashboardView';
import { GodotLabView } from './components/views/GodotLabView';
import {
  ExamEvaluationResult,
  RelicState,
  S3State,
  StationProgress,
  Student,
  TaskId,
} from './types';
import { apiLogin, apiSaveProgress, apiUseRelic, ServerState } from './api/client';


declare global {
  interface Window {
    G5L7Classroom?: {
      setContext: (student: Student, progress?: ServerState | null) => void;
      getStudent: () => Student | null;
      getProgress: () => unknown;
      reportStation: (taskId: string, payload?: object) => Promise<unknown>;
      useRelic: () => Promise<unknown>;
    };
  }
}

function syncBridgeContext(student: Student | null, state: ServerState | null) {
  try {
    window.G5L7Classroom?.setContext?.(student as Student, state);
  } catch {
    /* bridge optional */
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
  const [currentView, setCurrentView] = useState<
    'login' | 'intro' | 'map' | 'station1' | 'station2' | 'station3' | 'exam' | 'reward_game' | 'godot_lab'
  >('login');
  const [hasPlayedIntroOnce, setHasPlayedIntroOnce] = useState(false);

  const persist = useCallback(
    async (patch: Partial<ServerState>) => {
      if (!currentStudent) return false;
      try {
        const res = await apiSaveProgress(currentStudent.studentId, patch);
        setCurrentSession(res.state);
        syncBridgeContext(currentStudent, res.state);
        setSyncError('');
        return true;
      } catch (err: any) {
        setSyncError(err?.message || '进度同步失败');
        return false;
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
      syncBridgeContext(res.student, res.state);
      setCurrentView('intro');
    } catch (err: any) {
      setSyncError(err?.message || '登录失败，请确认课堂服务已启动');
    }
  };

  const handleUseRelic = async () => {
    if (!currentStudent) return;
    try {
      const res = await apiUseRelic(currentStudent.studentId);
      setCurrentSession(res.state);
    } catch (err: any) {
      setSyncError(err?.message || '法宝使用失败');
    }
  };

  const handleCompleteStation1 = async () => {
    if (!currentStudent || !currentSession) return;
    const nextStations = { ...currentSession.stations, s1_order: true };
    const nextRelics = {
      ...currentSession.relics,
      unlockedRelics: { ...currentSession.relics.unlockedRelics, whistle: true },
    };
    setCurrentSession({ ...currentSession, stations: nextStations, relics: nextRelics });
    // 先等 POST /api/progress 落盘，再跳转，避免教师大屏仍「尚无证据」
    const ok = await persist({ stations: nextStations, relics: nextRelics });
    if (ok) setCurrentView('station2');
  };

  const handleCompleteStation2 = async () => {
    if (!currentStudent || !currentSession) return;
    const nextStations = {
      ...currentSession.stations,
      s2_rewrite: true,
      s2_vs_branch: true,
      s2_kettle: true,
    };
    const nextRelics = {
      ...currentSession.relics,
      unlockedRelics: { ...currentSession.relics.unlockedRelics, arrow: true },
    };
    setCurrentSession({ ...currentSession, stations: nextStations, relics: nextRelics });
    const ok = await persist({ stations: nextStations, relics: nextRelics });
    if (ok) setCurrentView('station3');
  };

  const handleCompleteStation3 = async (detail: S3State) => {
    if (!currentStudent || !currentSession) return;
    const nextStations = { ...currentSession.stations, s3_timing: true };
    const nextRelics = {
      ...currentSession.relics,
      unlockedRelics: { ...currentSession.relics.unlockedRelics, knob: true },
    };
    setCurrentSession({
      ...currentSession,
      s3Detail: detail,
      stations: nextStations,
      relics: nextRelics,
    });
    const ok = await persist({ stations: nextStations, relics: nextRelics, s3Detail: detail });
    if (ok) setCurrentView('exam');
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

  const handleResetStation = (taskId: TaskId) => {
    if (!currentStudent || !currentSession) return;
    const nextStations = { ...currentSession.stations };
    if (taskId === 's1_order') nextStations.s1_order = false;
    if (taskId === 's2_rewrite') {
      nextStations.s2_rewrite = false;
      nextStations.s2_vs_branch = false;
      nextStations.s2_kettle = false;
    }
    if (taskId === 's3_timing') nextStations.s3_timing = false;
    setCurrentSession({ ...currentSession, stations: nextStations });
    void persist({ stations: nextStations });
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

      {currentView === 'intro' && (
        <IntroStoryModal
          isReplay={hasPlayedIntroOnce}
          onComplete={() => {
            setHasPlayedIntroOnce(true);
            setCurrentView('map');
          }}
          onSkip={() => {
            setHasPlayedIntroOnce(true);
            setCurrentView('map');
          }}
        />
      )}

      {currentView === 'map' && (
        <MainIntersectionMap
          student={currentStudent}
          progress={currentProgress}
          relics={currentRelics}
          s3State={currentS3State}
          onOpenStation={taskId => {
            if (taskId === 's1_order') setCurrentView('station1');
            if (taskId === 's2_rewrite') setCurrentView('station2');
            if (taskId === 's3_timing') setCurrentView('station3');
            if (taskId === 'exam') setCurrentView('exam');
          }}
          onUseRelic={handleUseRelic}
          onReplayIntro={() => setCurrentView('intro')}
          onResetStation={handleResetStation}
          onOpenRewardGame={() => setCurrentView('reward_game')}
          onOpenGodotLab={() => setCurrentView('godot_lab')}
          rewardUnlocked={currentSession?.rewardUnlocked}
        />
      )}

      {currentView === 'station1' && (
        <Station1CrosswalkView
          onComplete={handleCompleteStation1}
          onBackToMap={() => setCurrentView('map')}
        />
      )}

      {currentView === 'station2' && (
        <Station2LoopAnalysisView
          onComplete={handleCompleteStation2}
          onBackToMap={() => setCurrentView('map')}
        />
      )}

      {currentView === 'station3' && (
        <Station3TimingDispatchView
          onComplete={handleCompleteStation3}
          onBackToMap={() => setCurrentView('map')}
        />
      )}

      {currentView === 'exam' && currentStudent && (
        <ExamView
          studentId={currentStudent.studentId}
          onExamComplete={handleExamComplete}
          onOpenRewardGame={() => setCurrentView('reward_game')}
          onBackToMap={() => setCurrentView('map')}
        />
      )}

      {currentView === 'reward_game' && (
        <RewardLoopGame onBackToMap={() => setCurrentView('map')} />
      )}

      {currentView === 'godot_lab' && currentStudent && (
        <GodotLabView
          studentId={currentStudent.studentId}
          onBackToMap={() => setCurrentView('map')}
        />
      )}
    </div>
  );
}
