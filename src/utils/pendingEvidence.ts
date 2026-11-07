import type { LearningEvidence, StationProgress } from '../types';

export function mergePendingEvidence(saved: LearningEvidence[] = [], pending: LearningEvidence[]): LearningEvidence[] {
  const seen = new Set(saved.map(item => item.eventId));
  return [...saved, ...pending.filter(item => !seen.has(item.eventId))];
}

// Pending edits are not verified completion; keep them visible until the server acknowledges them.
export function progressWithPendingEdits(saved: StationProgress, pending: LearningEvidence[]): StationProgress {
  const progress = { ...saved };
  for (const item of pending) {
    if (item.eventType !== 'station_reset' && item.eventType !== 'current_invalidated') continue;
    if (item.taskId === 's1_order' || item.taskId === 's2_rewrite') {
      progress.s1_order = false;
      progress.s2_rewrite = false;
    } else if (item.taskId !== 'intro' && item.taskId !== 'exam') {
      progress[item.taskId] = false;
    }
  }
  return progress;
}
