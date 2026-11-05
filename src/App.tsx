import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoginView } from './components/views/LoginView';
import { ExamView } from './components/views/ExamView';
import { RewardLoopGame } from './components/views/RewardLoopGame';
import { TeacherDashboardView } from './components/views/TeacherDashboardView';
import { GodotPlayView } from './components/views/GodotPlayView';
import { StudioPlayView } from './components/views/StudioPlayView';
import {
  ExamEvaluationResult,
  RelicState,
  S3State,
  StationProgress,
  Student,
} from './types';
import { apiLogin, apiGetState, apiSaveProgress, apiUseRelic, ProgressPatch, ServerState, StationEvidence } from './api/client';
import { createSyncQueue, evidencePatch, resetPatch } from './utils/progressSync';

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
  const [hasSeenStudioIntro, setHasSeenStudioIntro] = useState(false);
  const usesStudio = window.isSecureContext === false;
  const syncQueue = useRef(createSyncQueue());

  const persist = useCallback(
    async (patch: ProgressPatch): Promise<boolean> => {
      if (!currentStudent) return false;
      try {
        const res = await syncQueue.current(() => apiSaveProgress(currentStudent.studentId, patch));
        setCurrentSession(res.state);
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
      setHasSeenStudioIntro(false);
      setCurrentView('godot');
    } catch (err: any) {
      setSyncError(err?.message || '登录失败，请确认课堂服务已启动');
    }
  };

  const handleUseRelic = async () => {
    if (!currentStudent) return;
    try {
      const res = await syncQueue.current(() => apiUseRelic(currentStudent.studentId));
      setCurrentSession(res.state);
    } catch (err: any) {
      setSyncError(err?.message || '法宝使用失败');
    }
  };

  const handleEvidence = (envelope: StationEvidence) => {
    void persist(evidencePatch(envelope));
  };

  const handleOpenExam = async () => {
    if (!currentStudent) return;
    try {
      // Godot can announce completion before the last HTTP save has finished.
      const res = await syncQueue.current(() => apiGetState(currentStudent.studentId));
      setCurrentSession(res.state);
      if (!res.state.examOpen) throw new Error('请先完成三个探究站并同步进度');
      setSyncError('');
      setCurrentView('exam');
    } catch (err: any) {
      setSyncError(err?.message || '开考核验失败，请重试');
    }
  };

  const handleExamComplete = (_result: ExamEvaluationResult, _answers: Record<string, any>, state: ServerState) => {
    setCurrentSession(state);
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

      {currentView === 'godot' && usesStudio && currentSession && (
        <StudioPlayView
          student={currentStudent}
          currentState={currentSession}
          hasSeenIntro={hasSeenStudioIntro}
          onIntroSeen={() => setHasSeenStudioIntro(true)}
          onPersist={persist}
          onExamOpen={handleOpenExam}
          onUseRelic={handleUseRelic}
          onRewardOpen={() => setCurrentView('reward_game')}
        />
      )}

      {currentView === 'godot' && !usesStudio && (
        <GodotPlayView
          student={currentStudent}
          progress={currentProgress}
          relics={currentRelics}
          s3State={currentS3State}
          examOpen={currentSession?.examOpen}
          onEvidence={handleEvidence}
          onExamOpen={() => void handleOpenExam()}
          onRelicUse={() => void handleUseRelic()}
          onResetStation={taskId => void persist(resetPatch(taskId))}
          onS3Detail={detail => {
            if (!currentSession) return;
            void persist({ s3Detail: detail });
          }}
        />
      )}

      {currentView === 'exam' && currentStudent && (
        <ExamView
          studentId={currentStudent.studentId}
          initialAnswers={currentSession?.examAnswers || undefined}
          initialResult={currentSession?.examResult || undefined}
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
