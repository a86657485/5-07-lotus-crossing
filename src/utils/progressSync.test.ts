import test from 'node:test';
import assert from 'node:assert/strict';
import { evidencePatch, resetPatch, createSyncQueue } from './progressSync';

test('Godot E1 records S1 and E1 without clearing later station fields', () => {
  const evidence = { taskId: 's2_rewrite', correct: true, payload: { backEdge: true } };
  const patch = evidencePatch(evidence);
  assert.deepEqual(patch.stations, { s1_order: true, s2_rewrite: true });
  assert.equal(patch.evidence, evidence);
  assert.deepEqual({ s2_vs_branch: true, ...patch.stations }, {
    s2_vs_branch: true, s1_order: true, s2_rewrite: true,
  });
});

test('an incorrect attempt is preserved without granting station completion', () => {
  const patch = evidencePatch({ taskId: 's2_kettle', correct: false, payload: {} });
  assert.equal(patch.stations, undefined);
  assert.equal(patch.evidence?.correct, false);
});

test('reset invalidates the current station without replenishing relics', () => {
  assert.deepEqual(resetPatch('s2_rewrite'), { stations: { s2_rewrite: false, s1_order: false } });
  const patch = resetPatch('s3_timing');
  assert.equal(patch.stations?.s3_timing, false);
  assert.equal(patch.s3Detail?.revalidateOk, false);
  assert.equal(patch.relics, undefined);
});

test('writes finish before the exam gate, and a failed request does not block retries', async () => {
  const queue = createSyncQueue();
  const order: string[] = [];
  let release!: () => void;
  const first = queue(async () => {
    order.push('save-start');
    await new Promise<void>(resolve => { release = resolve; });
    order.push('save-end');
  });
  const gate = queue(async () => { order.push('exam-gate'); });
  await Promise.resolve();
  assert.deepEqual(order, ['save-start']);
  release();
  await Promise.all([first, gate]);
  assert.deepEqual(order, ['save-start', 'save-end', 'exam-gate']);
  await assert.rejects(queue(async () => { throw new Error('offline'); }), /offline/);
  assert.equal(await queue(async () => 3), 3);
});
