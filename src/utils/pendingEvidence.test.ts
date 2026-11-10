import test from 'node:test';
import assert from 'node:assert/strict';
import type { LearningEvidence, StationProgress } from '../types';
import { mergePendingEvidence, progressWithPendingEdits } from './pendingEvidence';
import { restoreStationState } from '../components/lesson/stationRestore';

test('an offline reset remains the newest generation after refreshing before sync', () => {
  const saved: LearningEvidence[] = [
    { eventId: 'old-reset', taskId: 's3_timing', eventType: 'station_reset', payload: { resetId: 'old' } },
    { eventId: 'old-run', taskId: 's3_timing', eventType: 'simulation_run', payload: { kind: 'attempt', greenUnits: 9 } },
  ];
  const pending: LearningEvidence[] = [{ eventId: 'new-reset', taskId: 's3_timing', eventType: 'station_reset', payload: { resetId: 'pending-new' } }];
  const restored = restoreStationState({ taskId: 's3_timing', draft: { resetId: 'pending-new' }, evidence: mergePendingEvidence(saved, pending) });
  assert.equal(restored.baseline, false);
  assert.equal(restored.units, null);
  assert.deepEqual(restored.history, []);
  const progress = { s1_order: true, s2_rewrite: true, s2_vs_branch: true, s2_kettle: true, s3_timing: true, exam: true };
  assert.equal(progressWithPendingEdits(progress, pending).s3_timing, false);
  assert.equal(progressWithPendingEdits(progress, pending).exam, true);
});

test('acknowledged evidence is not duplicated and pending edits do not mutate saved progress', () => {
  const item: LearningEvidence = { eventId: 'same', taskId: 's2_rewrite', eventType: 'current_invalidated' };
  assert.equal(mergePendingEvidence([item], [item]).length, 1);
  const saved: StationProgress = { s1_order: true, s2_rewrite: true, s2_vs_branch: true, s2_kettle: true, s3_timing: true, exam: false };
  const projected = progressWithPendingEdits(saved, [item]);
  assert.equal(projected.s1_order, false);
  assert.equal(projected.s2_rewrite, false);
  assert.equal(saved.s1_order, true);
});
