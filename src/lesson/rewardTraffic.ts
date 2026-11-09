// Adapted from Crossroad.ToggleMode and DirectionAllowed in Traffic Light.
// Copyright 2018 Ruoyu Sun. MIT license in public/lesson/TrafficLight-LICENSE.txt.
// This exercise inserts a yellow phase between car and pedestrian passage.
type Phase = 'green' | 'yellow' | 'red';

interface TrafficRound {
  phase: Phase;
  carQueue: number;
  pedQueue: number;
  carsCleared: number;
  pedsCleared: number;
  completedLoops: number;
}

type TrafficAction =
  | { type: 'advance' }
  | { type: 'arrival'; pedestrian: boolean }
  | { type: 'tick' };

export const initialTrafficRound: TrafficRound = {
  phase: 'green',
  carQueue: 2,
  pedQueue: 1,
  carsCleared: 0,
  pedsCleared: 0,
  completedLoops: 0,
};

export function trafficRoundReducer(state: TrafficRound, action: TrafficAction): TrafficRound {
  if (action.type === 'advance') {
    switch (state.phase) {
      case 'green': return { ...state, phase: 'yellow' };
      case 'yellow': return { ...state, phase: 'red' };
      case 'red': return { ...state, phase: 'green', completedLoops: state.completedLoops + 1 };
    }
  }
  if (action.type === 'arrival') {
    return {
      ...state,
      carQueue: Math.min(10, state.carQueue + 1),
      pedQueue: Math.min(10, state.pedQueue + Number(action.pedestrian)),
    };
  }
  if (state.phase === 'green' && state.carQueue > 0) {
    return { ...state, carQueue: state.carQueue - 1, carsCleared: state.carsCleared + 1 };
  }
  if (state.phase === 'red' && state.pedQueue > 0) {
    return { ...state, pedQueue: state.pedQueue - 1, pedsCleared: state.pedsCleared + 1 };
  }
  return state;
}
