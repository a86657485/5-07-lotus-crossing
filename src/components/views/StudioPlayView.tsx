import React, { useRef, useState } from 'react';
import type { ProgressPatch, ServerState } from '../../api/client';
import type { Student, TaskId } from '../../types';
import { IntroStoryModal } from './IntroStoryModal';
import { MainIntersectionMap } from './MainIntersectionMap';
import { Station1CrosswalkView } from './Station1CrosswalkView';
import { Station2LoopAnalysisView, type Station2Evidence } from './Station2LoopAnalysisView';
import { Station3TimingDispatchView } from './Station3TimingDispatchView';

interface StudioPlayViewProps {
  student: Student;
  currentState: ServerState;
  hasSeenIntro: boolean;
  onIntroSeen: () => void;
  onPersist: (patch: ProgressPatch) => Promise<boolean>;
  onExamOpen: () => void | Promise<void>;
  onUseRelic: () => void | Promise<void>;
  onRewardOpen: () => void;
}

type StudioStation = 'map' | 's1' | 's2' | 's3';

export function studioResetPatch(taskId: Exclude<TaskId, 'exam'>): ProgressPatch {
  if (taskId.startsWith('s2_')) {
    return { stations: { s2_rewrite: false, s2_vs_branch: false, s2_kettle: false } };
  }
  if (taskId === 's3_timing') {
    return {
      stations: { s3_timing: false },
      s3Detail: {
        faultObserved: false, scenario: 'car_heavy', strategy: '', reason: '',
        ruleChanged: false, revalidateOk: false,
      },
    };
  }
  return { stations: { s1_order: false } };
}

export function studioS2Patches(evidence: Station2Evidence): ProgressPatch[] {
  return (['s2_rewrite', 's2_vs_branch', 's2_kettle'] as const).map(taskId => ({
    stations: { [taskId]: true },
    evidence: { taskId, correct: true, payload: evidence[taskId] },
  }));
}

/** Each saved subtask must succeed before the next write or navigation. */
export async function persistStudioPatches(
  patches: ProgressPatch[],
  persist: StudioPlayViewProps['onPersist']
): Promise<boolean> {
  for (const patch of patches) {
    if (!await persist(patch)) return false;
  }
  return true;
}

export const StudioPlayView: React.FC<StudioPlayViewProps> = ({
  student, currentState, hasSeenIntro, onIntroSeen, onPersist, onExamOpen, onUseRelic, onRewardOpen,
}) => {
  const [station, setStation] = useState<StudioStation>('map');
  const [showIntro, setShowIntro] = useState(!hasSeenIntro);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const withSave = async (operation: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await operation();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const loadStation = async (taskId: TaskId) => {
    if (taskId === 'exam') {
      await onExamOpen();
      return;
    }
    if (!await onPersist(studioResetPatch(taskId))) return;
    setStation(taskId === 's1_order' ? 's1' : taskId === 's3_timing' ? 's3' : 's2');
  };

  const openStation = (taskId: TaskId) => void withSave(() => loadStation(taskId));

  const completeStation = (patches: ProgressPatch[], nextTask: TaskId) => {
    void withSave(async () => {
      if (!await persistStudioPatches(patches, onPersist)) return;
      await loadStation(nextTask);
    });
  };

  const finishIntro = () => {
    onIntroSeen();
    setShowIntro(false);
  };

  return (
    <div aria-busy={busy} inert={busy ? true : undefined}>
      {station === 'map' && (
        <MainIntersectionMap
          student={student}
          progress={currentState.stations}
          relics={currentState.relics}
          s3State={currentState.s3Detail}
          onOpenStation={openStation}
          onResetStation={taskId => openStation(taskId === 'exam' ? 's3_timing' : taskId)}
          onUseRelic={() => void onUseRelic()}
          onReplayIntro={() => setShowIntro(true)}
          onOpenRewardGame={onRewardOpen}
          rewardUnlocked={currentState.rewardUnlocked}
        />
      )}
      {showIntro && <IntroStoryModal isReplay={hasSeenIntro} onComplete={finishIntro} onSkip={finishIntro} />}
      {station === 's1' && (
        <Station1CrosswalkView
          onBackToMap={() => setStation('map')}
          onComplete={payload => completeStation([{
            stations: { s1_order: true },
            evidence: { taskId: 's1_order', correct: true, payload: { ...payload } },
          }], 's2_rewrite')}
        />
      )}
      {station === 's2' && (
        <Station2LoopAnalysisView
          onBackToMap={() => setStation('map')}
          onComplete={evidence => completeStation(studioS2Patches(evidence), 's3_timing')}
        />
      )}
      {station === 's3' && (
        <Station3TimingDispatchView
          onBackToMap={() => setStation('map')}
          onComplete={detail => completeStation([{
            stations: { s3_timing: true },
            s3Detail: detail,
            evidence: { taskId: 's3_timing', correct: true, s3Detail: detail, payload: { ...detail } },
          }], 'exam')}
        />
      )}
    </div>
  );
};
