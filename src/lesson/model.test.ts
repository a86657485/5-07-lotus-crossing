import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCrossingPlan, simulateCrossing, simulateKettle, simulateTraffic,
  isTrafficReasonCorrect, simulateMaze, crossingLightAt, type CrossingPlan,
} from './model';

const crossing: CrossingPlan = { condition: 'cond_green_off', yes: 'observe', no: 'cross' };

test('repeating arrival may cross safely but does not describe only the repeated observation', () => {
  const plan: CrossingPlan = { ...crossing, yes: 'start' };
  const green = simulateCrossing(plan, 'green_at_start');
  const red = simulateCrossing(plan, 'red_then_green');
  assert.equal(green.outcome, 'crossed_green');
  assert.equal(red.outcome, 'crossed_green');
  assert.ok(red.trace.filter(step => step.nodeId === 'start').length > 1);
  assert.equal(green.correct, false);
  assert.equal(red.correct, false);
});

test('crossing repeats while red and exits when green; initially green observes only once', () => {
  const green = simulateCrossing(crossing, 'green_at_start');
  const red = simulateCrossing(crossing, 'red_then_green');
  assert.equal(green.correct, true);
  assert.equal(green.observations, 1);
  assert.equal(red.correct, true);
  assert.equal(red.observations, 5);
  assert.equal(red.trace.filter(step => step.nodeId === 'observe').length, 5);
  assert.equal(red.trace.at(-1)?.person, 'crossing');
});

test('signal changes on its own clock and the same plan handles different red durations', () => {
  assert.equal(crossingLightAt('red_then_green', 8, 9), 'red');
  assert.equal(crossingLightAt('red_then_green', 9, 9), 'green');
  for (const redDuration of [1, 5, 9, 13]) {
    const result = simulateCrossing(crossing, 'red_then_green', { redDuration });
    assert.equal(result.correct, true);
    const crossingStep = result.trace.find(step => step.nodeId === 'cross');
    assert.ok((crossingStep?.elapsedUnits ?? 0) >= redDuration);
  }
});

test('a reversed exit is blocked at the red curb and an endless loop is bounded', () => {
  const reverse = { ...crossing, yes: 'cross', no: 'observe' } as CrossingPlan;
  assert.equal(simulateCrossing(reverse, 'red_then_green').outcome, 'red_blocked');
  const loop = simulateCrossing(reverse, 'green_at_start');
  assert.equal(loop.outcome, 'step_limit');
  assert.equal(loop.correct, false);
  assert.ok(loop.trace.length <= 28);
});

test('waiting three observations is not the same rule as waiting for green', () => {
  const count: CrossingPlan = { condition: 'cond_count', yes: 'cross', no: 'observe' };
  const red = simulateCrossing(count, 'red_then_green');
  assert.equal(red.outcome, 'red_blocked');
  assert.equal(red.observations, 3);
  assert.equal(red.correct, false);
});

test('a successful coincidence in one case does not certify a wrong condition', () => {
  const plan: CrossingPlan = { condition: 'cond_bridge', yes: 'observe', no: 'cross' };
  assert.equal(simulateCrossing(plan, 'green_at_start').outcome, 'crossed_green');
  assert.equal(simulateCrossing(plan, 'green_at_start').correct, false);
  assert.equal(simulateCrossing(plan, 'red_then_green').outcome, 'red_blocked');
});

test('missing or stale restored choices remain incomplete and safe', () => {
  assert.deepEqual(normalizeCrossingPlan(null), { condition: '', yes: '', no: '' });
  const restored = normalizeCrossingPlan({ condition: 'old-value', yes: 'end', no: 'not-a-node' });
  assert.deepEqual(restored, { condition: '', yes: 'end', no: '' });
  assert.equal(simulateCrossing(restored, 'red_then_green').outcome, 'incomplete');
});

test('actions cannot be used as a yes/no question and finishing at the curb is not arrival', () => {
  assert.equal(simulateCrossing({ ...crossing, condition: 'act_as_diamond' }, 'green_at_start').outcome, 'not_a_condition');
  assert.equal(simulateCrossing({ ...crossing, no: 'end' }, 'green_at_start').outcome, 'ended_at_curb');
});

test('kettle first reads and judges before heating; reading never changes temperature', () => {
  const trace = simulateKettle(80);
  assert.deepEqual(trace.slice(0, 3).map(step => step.nodeId), ['start', 'check', 'decide']);
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].temperature !== trace[i - 1].temperature) assert.equal(trace[i].nodeId, 'heat');
  }
  assert.equal(trace.filter(step => step.nodeId === 'heat').length, 2);
  assert.equal(trace.at(-1)?.temperature, 100);
  assert.equal(trace.at(-1)?.heating, false);
});

test('an already hot kettle is read and stopped without any heating action', () => {
  const trace = simulateKettle(100);
  assert.equal(trace.some(step => step.nodeId === 'heat'), false);
  assert.deepEqual(trace.map(step => step.nodeId), ['start', 'check', 'decide', 'stop', 'end']);
});

test('malformed persisted numeric values cannot make an unbounded simulation', () => {
  assert.throws(() => simulateKettle(Number.NaN as 80), RangeError);
  assert.throws(() => simulateTraffic(Infinity as 3), RangeError);
  assert.throws(() => simulateMaze({ condition: 'not_at_goal', action: 'forward' }, 0 as 3), RangeError);
});

test('traffic results depend only on the simulated duration and keep the pedestrian phase', () => {
  const runs = ([3, 6, 9] as const).map(simulateTraffic);
  assert.deepEqual(runs.map(run => run.remainingCars), [9, 6, 3]);
  assert.deepEqual(runs.map(run => run.passedCars), [3, 6, 9]);
  assert.ok(runs.every(run => run.initialCars === 12 && run.pedestrianUnits === 6));
  assert.ok(runs.every(run => run.trace.at(-1)?.carsWaiting === run.remainingCars));
  assert.equal(isTrafficReasonCorrect('rs_evacuate'), true);
  assert.equal(isTrafficReasonCorrect('rs_random'), false);
  assert.deepEqual(simulateTraffic(6), simulateTraffic(6));
});

test('one maze rule reaches goals of different distances without counting first', () => {
  for (const length of [3, 5] as const) {
    const result = simulateMaze({ condition: 'not_at_goal', action: 'forward' }, length);
    assert.equal(result.correct, true);
    assert.equal(result.position, length);
    assert.equal(result.trace.filter(step => step.nodeId === 'move').length, length);
  }
});

test('maze incorrect conditions and waiting have observable, bounded outcomes', () => {
  assert.equal(simulateMaze({ condition: 'at_goal', action: 'forward' }, 3).outcome, 'stopped_early');
  assert.equal(simulateMaze({ condition: 'not_at_goal', action: 'wait' }, 5).outcome, 'step_limit');
  assert.equal(simulateMaze({ condition: 'steps_three', action: 'forward' }, 5).correct, false);
});
