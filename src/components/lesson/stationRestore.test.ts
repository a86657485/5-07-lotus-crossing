import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreStationState, scaffoldFor } from './stationRestore';

const baseline = { eventId: 'before', taskId: 's3_timing', eventType: 'simulation_run', payload: { kind: 'baseline', greenUnits: 3 } };
const attempt = { eventId: 'run', taskId: 's3_timing', eventType: 'simulation_run', correct: false, payload: { kind: 'attempt', greenUnits: 6, reason: 'wrong' } };

test('ordinary re-entry restores the current baseline and arrangement', () => {
  const result = restoreStationState({ taskId: 's3_timing', evidence: [baseline, attempt], draft: { units: 9, reason: 'rs_evacuate' } });
  assert.equal(result.baseline, true);
  assert.equal(result.units, 9);
  assert.equal(result.reason, 'rs_evacuate');
  assert.equal(result.history.length, 2);
  assert.equal(result.errorCount, 1);
});

test('a server restart discards earlier runs and a draft from another generation', () => {
  const result = restoreStationState({ taskId: 's3_timing', evidence: [baseline, { eventId: 'reset', taskId: 's3_timing', eventType: 'station_reset', payload: { resetId: 'new' } }], initialS3: { faultObserved: true, runHistory: [baseline.payload] }, draft: { resetId: 'old', units: 9, reason: 'rs_evacuate' } });
  assert.equal(result.baseline, false);
  assert.equal(result.units, null);
  assert.equal(result.reason, '');
  assert.equal(result.history.length, 0);
  assert.equal(result.resetId, 'new');
});

test('freshStart wins a network race while prior concept support stays known', () => {
  const result = restoreStationState({ taskId: 's3_timing', freshStart: true, resetId: 'pending-reset', evidence: [baseline, { taskId: 's3_timing', eventType: 'scenario_run', payload: { kind: 'concept_support', supportUsed: true } }], initialS3: { faultObserved: true }, draft: { units: 9, reason: 'rs_evacuate' } });
  assert.equal(result.baseline, false);
  assert.equal(result.units, null);
  assert.equal(result.history.length, 0);
  assert.equal(result.supportUsed, true);
  assert.equal(result.resetId, 'pending-reset');
});

test('a new-generation draft survives ordinary re-entry without resurrecting an old baseline', () => {
  const result = restoreStationState({ taskId: 's3_timing', resetId: 'new', evidence: [baseline], draft: { resetId: 'new', units: 6, reason: 'rs_evacuate' } });
  assert.equal(result.units, 6);
  // Pending reset has not reached the server: the old run still must not become a baseline.
  assert.equal(result.baseline, false);
});

test('support and error level persist from the student task draft', () => {
  const result = restoreStationState({ taskId: 's2_rewrite', draft: { supportUsed: true, errorCount: 3 }, evidence: [] });
  assert.equal(result.supportUsed, true);
  assert.equal(scaffoldFor('s1', result.errorCount).level, 3);
  assert.equal(scaffoldFor('s1', 1).level, 1);
  assert.equal(scaffoldFor('s1', 2).level, 2);
});

test('clearing a draft for restart does not erase prior support or its progressive level', () => {
  const result = restoreStationState({ taskId: 's2_rewrite', freshStart: true, resetId: 'fresh', evidence: [{ taskId: 's2_rewrite', eventType: 'scenario_run', payload: { kind: 'error_scaffold', supportUsed: true, errorCount: 3 } }] });
  assert.equal(result.supportUsed, true);
  assert.equal(result.errorCount, 3);
  assert.equal(scaffoldFor('s1', result.errorCount).level, 3);
});
