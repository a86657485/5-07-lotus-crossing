import assert from 'node:assert/strict';
import test from 'node:test';
import { runTimingComparison } from './TimingComparison';

test('already-clean tables can skip wiping only when checking comes first', () => {
  const result = runTimingComparison(true);
  assert.equal(result.traces.ask[0], 'check');
  assert.equal(result.traces.doFirst[0], 'wipe');
  assert.deepEqual(result.wipeCounts, { ask: 0, doFirst: 1 });
  assert.equal(result.traces.ask.at(-1), 'end');
  assert.equal(result.traces.doFirst.at(-1), 'end');
});

test('a dirty table requires wiping in both arrangements', () => {
  const result = runTimingComparison(false);
  assert.deepEqual(result.wipeCounts, { ask: 1, doFirst: 1 });
  assert.equal(result.traces.ask.filter(action => action === 'check').length, 2);
});
