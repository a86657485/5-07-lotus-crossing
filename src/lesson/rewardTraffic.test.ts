import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTrafficRound, trafficRoundReducer } from './rewardTraffic';

test('first completed cycle is counted only when red returns to green', () => {
  let round = initialTrafficRound;
  assert.equal(round.completedLoops, 0);
  round = trafficRoundReducer(round, { type: 'advance' });
  assert.deepEqual([round.phase, round.completedLoops], ['yellow', 0]);
  round = trafficRoundReducer(round, { type: 'advance' });
  assert.deepEqual([round.phase, round.completedLoops], ['red', 0]);
  round = trafficRoundReducer(round, { type: 'advance' });
  assert.deepEqual([round.phase, round.completedLoops], ['green', 1]);
  assert.equal(initialTrafficRound.completedLoops, 0);
});

test('vehicles and pedestrians use different phases and yellow clears neither queue', () => {
  const green = trafficRoundReducer(initialTrafficRound, { type: 'tick' });
  assert.deepEqual([green.carsCleared, green.pedsCleared], [1, 0]);
  const yellow = trafficRoundReducer(green, { type: 'advance' });
  assert.equal(trafficRoundReducer(yellow, { type: 'tick' }), yellow);
  const red = trafficRoundReducer(yellow, { type: 'advance' });
  assert.deepEqual(
    [trafficRoundReducer(red, { type: 'tick' }).pedsCleared, red.carsCleared],
    [1, 1],
  );
});
