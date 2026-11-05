import test from 'node:test';
import assert from 'node:assert/strict';
import { persistStudioPatches, studioResetPatch, studioS2Patches } from '../components/views/StudioPlayView';
import type { ProgressPatch } from '../api/client';

const choices = {
  s2_rewrite: { condition: '学生所选条件', action: '学生所选动作', backEdge: '学生所选回边' },
  s2_vs_branch: { choice: 'loop' as const },
  s2_kettle: { condition: '学生所选水温条件', action: '学生所选加热步骤', timing: 'ask_first' as const },
};

test('Studio S2 preserves each subtask choice and sends three partial station patches without a Godot S1 alias', () => {
  const patches = studioS2Patches(choices);
  assert.deepEqual(patches.map(patch => patch.evidence?.taskId), ['s2_rewrite', 's2_vs_branch', 's2_kettle']);
  for (const patch of patches) {
    const taskId = patch.evidence!.taskId as keyof typeof choices;
    assert.deepEqual(patch.stations, { [taskId]: true });
    assert.deepEqual(patch.evidence, { taskId, correct: true, payload: choices[taskId] });
    assert.equal(patch.relics, undefined);
  }
});

test('Studio station reset clears only its current station and S3 also clears revalidation', () => {
  assert.deepEqual(studioResetPatch('s1_order'), { stations: { s1_order: false } });
  const s2 = { stations: { s2_rewrite: false, s2_vs_branch: false, s2_kettle: false } };
  for (const taskId of ['s2_rewrite', 's2_vs_branch', 's2_kettle'] as const) {
    assert.deepEqual(studioResetPatch(taskId), s2);
  }
  const s3 = studioResetPatch('s3_timing');
  assert.deepEqual(s3.stations, { s3_timing: false });
  assert.equal(s3.s3Detail?.revalidateOk, false);
  assert.equal(s3.s3Detail?.ruleChanged, false);
  assert.equal(s3.relics, undefined);
});

test('Studio waits for each authoritative write before starting the next completion write', async () => {
  const patches = studioS2Patches(choices);
  const writes: ProgressPatch[] = [];
  let releaseFirst!: (value: boolean) => void;
  const first = new Promise<boolean>(resolve => { releaseFirst = resolve; });
  const saving = persistStudioPatches(patches, async patch => {
    writes.push(patch);
    return writes.length === 1 ? first : true;
  });
  assert.equal(writes.length, 1);
  await Promise.resolve();
  assert.equal(writes.length, 1);
  releaseFirst(true);
  assert.equal(await saving, true);
  assert.deepEqual(writes, patches);
});

test('a failed Studio save stops later completion writes and does not report a station complete', async () => {
  const patches = studioS2Patches(choices);
  const writes: ProgressPatch[] = [];
  const saved = await persistStudioPatches(patches, async patch => {
    writes.push(patch);
    return writes.length !== 2;
  });
  assert.equal(saved, false);
  assert.deepEqual(writes, patches.slice(0, 2));
});
