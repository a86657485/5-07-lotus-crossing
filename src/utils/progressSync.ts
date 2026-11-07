import type { ProgressPatch, StationEvidence } from '../api/client';
import type { S3State, TaskId } from '../types';

/** Send only changed station fields; an older event must not clear another station. */
export function evidencePatch(evidence: StationEvidence): ProgressPatch {
  const patch: ProgressPatch = { evidence };
  if (evidence.correct !== true) return patch;
  switch (evidence.taskId) {
    case 's1_order':
      patch.stations = { s1_order: true };
      break;
    case 's2_rewrite':
      // The current Godot S1 flowchart reports E1 under s2_rewrite.
      patch.stations = { s1_order: true, s2_rewrite: true };
      break;
    case 's2_vs_branch':
    case 's2_kettle':
    case 's3_timing':
      patch.stations = { [evidence.taskId]: true };
      break;
  }
  if (evidence.taskId === 's3_timing' && evidence.s3Detail) {
    patch.s3Detail = evidence.s3Detail;
  }
  return patch;
}

export function resetPatch(taskId: TaskId): ProgressPatch {
  const stations: ProgressPatch['stations'] = { [taskId]: false };
  if (taskId === 's2_rewrite' || taskId === 's1_order') {
    stations.s1_order = false;
    stations.s2_rewrite = false;
  }
  const patch: ProgressPatch = { stations };
  if (taskId === 's3_timing') {
    patch.s3Detail = {
      faultObserved: false, scenario: 'car_heavy', strategy: '', reason: '',
      ruleChanged: false, revalidateOk: false,
    } satisfies S3State;
  }
  return patch;
}

/** Keep HTTP writes and the final exam gate in the order of student actions. */
export function createSyncQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  };
}
