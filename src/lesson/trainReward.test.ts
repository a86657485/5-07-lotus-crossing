import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainRound, TRAIN_LAP_LIMIT, TRAIN_ORDER_INDICES, trainRoundReducer } from './trainReward';
import type { CargoKind, TrainRound } from './trainReward';

function runLap(round: TrainRound, lane: CargoKind) {
  if (round.lane !== lane) round = trainRoundReducer(round, { type: 'switch' });
  round = trainRoundReducer(round, { type: 'lock' });
  round = trainRoundReducer(round, { type: 'load' });
  round = trainRoundReducer(round, { type: 'check' });
  return trainRoundReducer(round, { type: 'continue' });
}

test('three suitable laps fill the first order and send the train to the depot', () => {
  let round = trainRoundReducer(createTrainRound(0, 'three'), { type: 'start' });
  round = runLap(round, 'water');
  round = runLap(round, 'tools');
  assert.equal(round.phase, 'approach');
  round = runLap(round, 'water');
  assert.deepEqual(round.cargo, { water: 2, tools: 1 });
  assert.deepEqual(round.route, ['water', 'tools', 'water']);
  assert.equal(round.completedRounds, 3);
  assert.equal(round.phase, 'depot');
  assert.equal(round.result, 'filled');
  assert.equal(trainRoundReducer(round, { type: 'finish' }).phase, 'done');
});

test('three laps stop with the second order one box short even with suitable routes', () => {
  let round = trainRoundReducer(createTrainRound(1, 'three'), { type: 'start' });
  round = runLap(round, 'water');
  round = runLap(round, 'tools');
  round = runLap(round, 'tools');
  assert.deepEqual(round.cargo, { water: 1, tools: 2 });
  assert.equal(round.completedRounds, 3);
  assert.equal(round.phase, 'depot');
  assert.equal(round.result, 'short');
});

test('the order-filled rule stops after the cargo totals for all five orders', () => {
  const minimumLaps = [3, 4, 5, 6, 8];
  for (const orderIndex of TRAIN_ORDER_INDICES) {
    let round = trainRoundReducer(createTrainRound(orderIndex, 'fulfilled'), { type: 'start' });
    const { water, tools } = round.order;
    const lanes = [...Array<CargoKind>(water).fill('water'), ...Array<CargoKind>(tools).fill('tools')];
    for (const [index, lane] of lanes.entries()) {
      assert.equal(round.phase, 'approach');
      assert.equal(round.completedRounds, index);
      assert.equal(round.result, null);
      round = runLap(round, lane);
    }
    assert.equal(round.completedRounds, minimumLaps[orderIndex]);
    assert.deepEqual(round.route, lanes);
    assert.equal(round.phase, 'depot');
    assert.equal(round.result, 'filled');
  }
});

test('the lap limit returns an unfilled train but accepts an order filled exactly at the limit', () => {
  let unfilled = trainRoundReducer(createTrainRound(4, 'fulfilled'), { type: 'start' });
  for (let lap = 0; lap < TRAIN_LAP_LIMIT; lap++) {
    assert.equal(unfilled.phase, 'approach');
    unfilled = runLap(unfilled, 'water');
  }
  assert.equal(unfilled.phase, 'depot');
  assert.equal(unfilled.result, 'short');
  assert.deepEqual(unfilled.cargo, { water: 4, tools: 0 });
  assert.equal(unfilled.route.length, TRAIN_LAP_LIMIT);

  let filled = trainRoundReducer(createTrainRound(4, 'fulfilled'), { type: 'start' });
  for (let lap = 0; lap < TRAIN_LAP_LIMIT; lap++) {
    filled = runLap(filled, lap < TRAIN_LAP_LIMIT - 4 ? 'water' : 'tools');
  }
  assert.equal(filled.phase, 'depot');
  assert.equal(filled.result, 'filled');
  assert.equal(filled.completedRounds, TRAIN_LAP_LIMIT);
});

test('a repeated visit to a filled station does not load extra cargo or prevent another lap', () => {
  let round = trainRoundReducer(createTrainRound(0, 'fulfilled'), { type: 'start' });
  round = runLap(round, 'tools');
  round = trainRoundReducer(round, { type: 'lock' });
  round = trainRoundReducer(round, { type: 'load' });
  assert.deepEqual(round.cargo, { water: 0, tools: 1 });
  assert.equal(round.lastLoad, null);
  round = trainRoundReducer(round, { type: 'check' });
  round = trainRoundReducer(round, { type: 'continue' });
  assert.equal(round.phase, 'approach');
  round = runLap(round, 'water');
  round = runLap(round, 'water');
  assert.equal(round.result, 'filled');
  assert.equal(round.completedRounds, 4);
});

test('the junction locks the selected route and a late switch cannot change the shipment', () => {
  const ready = createTrainRound(0, 'three');
  const approach = trainRoundReducer(ready, { type: 'start' });
  assert.equal(approach.lane, 'water');
  const switched = trainRoundReducer(approach, { type: 'switch' });
  const locked = trainRoundReducer(switched, { type: 'lock' });
  assert.equal(locked.committedLane, 'tools');
  assert.equal(trainRoundReducer(locked, { type: 'switch' }), locked);
  const loading = trainRoundReducer(locked, { type: 'load' });
  assert.deepEqual(loading.cargo, { water: 0, tools: 1 });
  assert.equal(loading.lastLoad, 'tools');
  assert.equal(loading.completedRounds, 0);
  assert.equal(trainRoundReducer(loading, { type: 'load' }), loading);
  assert.deepEqual(ready.cargo, { water: 0, tools: 0 });
});
