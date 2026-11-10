import test from 'node:test';
import assert from 'node:assert/strict';
import { getStationGuide } from './stationGuidance';
import type { CrossingPlan } from '../../lesson/model';

const idle = { playback: 'idle' as const, passed: false, completionLabel: '完成任务' };
const plan: CrossingPlan = { condition: 'cond_green_off', yes: 'observe', no: 'cross' };

test('one verified light scenario guides the learner to the other scenario before rerunning', () => {
  const guide = getStationGuide({ ...idle, station: 's1', plan, branch: '', selectedTested: true, bothTested: false });
  assert.equal(guide.target, 'crossingCase');
  assert.match(guide.hint, /另一种灯色/);
});

test('completed stations guide the completion control rather than repeating the last step', () => {
  const complete = { ...idle, passed: true };
  const guides = [
    getStationGuide({ ...complete, completionLabel: '完成引导台', station: 's1', plan, branch: '', selectedTested: true, bothTested: true }),
    getStationGuide({ ...complete, completionLabel: '继续看热水壶', station: 's2b', selected: true, viewed: true, edgeChosen: true }),
    getStationGuide({ ...complete, completionLabel: '完成拆解台', station: 's2c', testedTemperatures: 2, selectedTested: true, currentQuestion: 2, choices: ['heat', 'at100', 'ask'], comparedTiming: true }),
    getStationGuide({ ...complete, completionLabel: '完成调度台', station: 's3', baseline: true, units: true, reason: true }),
  ];
  assert.deepEqual(guides.map(guide => guide.target), ['complete', 'complete', 'complete', 'complete']);
  assert.deepEqual(guides.map(guide => guide.hint), ['已验证，点“完成引导台”继续。', '已验证，点“继续看热水壶”继续。', '已验证，点“完成拆解台”继续。', '已验证，点“完成调度台”继续。']);
});

test('diagram comparison guides viewing before evidence selection and checking', () => {
  const selection = { ...idle, station: 's2b' as const, selected: true, viewed: false, edgeChosen: false };
  assert.equal(getStationGuide(selection).target, 'comparisonReplay');
  assert.equal(getStationGuide({ ...selection, playback: 'running' }).target, 'playback');
  assert.equal(getStationGuide({ ...selection, viewed: true }).target, 'comparison');
  assert.equal(getStationGuide({ ...selection, viewed: true, edgeChosen: true }).target, 'check');
});

test('failed verification directs students back to the choices that can change the result', () => {
  const retry = { ...idle, needsRevision: true };
  assert.equal(getStationGuide({ ...retry, station: 's2b', selected: true, viewed: true, edgeChosen: true }).target, 'comparison');
  assert.equal(getStationGuide({ ...retry, station: 's2c', testedTemperatures: 2, selectedTested: true, currentQuestion: 2, choices: ['heat', 'at100', 'doFirst'], comparedTiming: true }).target, 'kettle');
  assert.equal(getStationGuide({ ...retry, station: 's3', baseline: true, units: true, reason: true, reducedQueue: true }).target, 'reason');
  assert.equal(getStationGuide({ ...retry, station: 's3', baseline: true, units: true, reason: true, reducedQueue: false }).target, 'duration');
});
