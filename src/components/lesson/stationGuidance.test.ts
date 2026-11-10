import test from 'node:test';
import assert from 'node:assert/strict';
import { getStationGuide } from './stationGuidance';
import type { CrossingPlan } from '../../lesson/model';
import { FIVE_CONDITION_ORDER, FIVE_CONDITION_DEMO_ARROWS } from '../../lesson/model';

const idle = { playback: 'idle' as const, passed: false, completionLabel: '完成任务' };
const plan: CrossingPlan = { condition: 'cond_green_off', yes: 'observe', no: 'cross' };
const fiveDone = { testedConditions: FIVE_CONDITION_ORDER, allFiveTested: true };

test('phase A guides the next untested card, then the run button after it is selected', () => {
  const base = { ...idle, station: 's1' as const, plan: { condition: '', yes: '', no: '' } as CrossingPlan, branch: '' as const, selectedTested: false, bothTested: false, testedConditions: [] as string[], allFiveTested: false };
  const first = getStationGuide(base);
  assert.equal(first.target, 'nextCondition');
  assert.match(first.hint, /有可用天桥/);
  assert.equal(first.nextCondition, 'cond_bridge');

  const selected = getStationGuide({ ...base, plan: { condition: 'cond_bridge', ...FIVE_CONDITION_DEMO_ARROWS.cond_bridge } });
  assert.equal(selected.target, 'run');
  assert.match(selected.hint, /运行/);

  const afterBridge = getStationGuide({ ...base, testedConditions: ['cond_bridge'] });
  assert.equal(afterBridge.target, 'nextCondition');
  assert.equal(afterBridge.nextCondition, 'cond_count');
  assert.match(afterBridge.hint, /已经等了三次/);
});

test('phase B starts only after all five cards are tested and does not keep demo arrows as the task', () => {
  const cleared: CrossingPlan = { condition: 'cond_green_off', yes: '', no: '' };
  const guide = getStationGuide({ ...idle, station: 's1', plan: cleared, branch: '', selectedTested: false, bothTested: false, ...fiveDone });
  assert.equal(guide.target, 'flow');
  assert.match(guide.hint, /是.*否/);
});

test('phase B asks for the wait-loop condition if a trial card is still selected', () => {
  const trial: CrossingPlan = { condition: 'cond_bridge', yes: 'bridge', no: 'cross' };
  const guide = getStationGuide({ ...idle, station: 's1', plan: trial, branch: '', selectedTested: false, bothTested: false, ...fiveDone });
  assert.equal(guide.target, 'conditions');
  assert.match(guide.hint, /还要再等/);
});

test('one correctly verified light scenario guides the learner to the other scenario before rerunning', () => {
  const guide = getStationGuide({ ...idle, station: 's1', plan, branch: '', selectedTested: true, bothTested: false, ...fiveDone });
  assert.equal(guide.target, 'crossingCase');
  assert.match(guide.hint, /另一种灯色/);
});

test('wrong-condition runs are not treated as verified light colors', () => {
  const wrong: CrossingPlan = { condition: 'cond_bridge', yes: 'bridge', no: 'cross' };
  const guide = getStationGuide({ ...idle, station: 's1', plan: wrong, branch: '', selectedTested: false, bothTested: false, ...fiveDone });
  assert.equal(guide.target, 'conditions');
  assert.notEqual(guide.target, 'complete');
});

test('completed stations guide the completion control rather than repeating the last step', () => {
  const complete = { ...idle, passed: true };
  const guides = [
    getStationGuide({ ...complete, completionLabel: '完成引导台', station: 's1', plan, branch: '', selectedTested: true, bothTested: true, ...fiveDone }),
    getStationGuide({ ...complete, completionLabel: '继续看热水壶', station: 's2b', selected: true, viewed: true, viewedBoth: true, edgeChosen: true }),
    getStationGuide({ ...complete, completionLabel: '完成拆解台', station: 's2c', testedTemperatures: 2, selectedTested: true, currentQuestion: 2, choices: ['heat', 'at100', 'ask'], comparedTiming: true }),
    getStationGuide({ ...complete, completionLabel: '完成调度台', station: 's3', baseline: true, units: true, reason: true }),
  ];
  assert.deepEqual(guides.map(guide => guide.target), ['complete', 'complete', 'complete', 'complete']);
  assert.deepEqual(guides.map(guide => guide.hint), ['已验证，点“完成引导台”继续。', '已验证，点“继续看热水壶”继续。', '已验证，点“完成拆解台”继续。', '已验证，点“完成调度台”继续。']);
});

test('diagram comparison requires both diagrams to be run before evidence selection and checking', () => {
  const selection = { ...idle, station: 's2b' as const, selected: true, viewed: false, viewedBoth: false, edgeChosen: false };
  assert.equal(getStationGuide(selection).target, 'comparisonReplay');
  assert.equal(getStationGuide({ ...selection, playback: 'running' }).target, 'playback');
  assert.equal(getStationGuide({ ...selection, viewed: true, viewedBoth: false }).target, 'comparison');
  assert.match(getStationGuide({ ...selection, viewed: true, viewedBoth: false }).hint, /另一张图/);
  assert.equal(getStationGuide({ ...selection, viewed: true, viewedBoth: true }).target, 'comparison');
  assert.match(getStationGuide({ ...selection, viewed: true, viewedBoth: true }).hint, /依据/);
  assert.equal(getStationGuide({ ...selection, viewed: true, viewedBoth: true, edgeChosen: true }).target, 'check');
});

test('failed verification directs students back to the choices that can change the result', () => {
  const retry = { ...idle, needsRevision: true };
  assert.equal(getStationGuide({ ...retry, station: 's2b', selected: true, viewed: true, viewedBoth: true, edgeChosen: true }).target, 'comparison');
  assert.equal(getStationGuide({ ...retry, station: 's2c', testedTemperatures: 2, selectedTested: true, currentQuestion: 2, choices: ['heat', 'at100', 'doFirst'], comparedTiming: true }).target, 'kettle');
  assert.equal(getStationGuide({ ...retry, station: 's3', baseline: true, units: true, reason: true, reducedQueue: true }).target, 'reason');
  assert.equal(getStationGuide({ ...retry, station: 's3', baseline: true, units: true, reason: true, reducedQueue: false }).target, 'duration');
});
