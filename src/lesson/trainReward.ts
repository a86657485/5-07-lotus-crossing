export const TRAIN_ORDERS = [
  { water: 2, tools: 1 },
  { water: 1, tools: 3 },
] as const;

export type CargoKind = 'water' | 'tools';
export type TrainOrderIndex = 0 | 1;
export type TrainRule = 'three' | 'fulfilled';
export type TrainPhase = 'ready' | 'approach' | 'locked' | 'loading' | 'checking' | 'depot' | 'done';

type Cargo = Record<CargoKind, number>;

export type TrainRound = {
  orderIndex: TrainOrderIndex;
  order: Readonly<Cargo>;
  rule: TrainRule;
  phase: TrainPhase;
  lane: CargoKind;
  committedLane: CargoKind | null;
  cargo: Cargo;
  completedRounds: number;
  lastLoad: CargoKind | null;
  result: 'filled' | 'short' | null;
};

export type TrainAction = { type: 'start' | 'switch' | 'lock' | 'load' | 'check' | 'continue' | 'finish' };

export function createTrainRound(orderIndex: TrainOrderIndex, rule: TrainRule): TrainRound {
  return {
    orderIndex,
    order: TRAIN_ORDERS[orderIndex],
    rule,
    phase: 'ready',
    lane: 'water',
    committedLane: null,
    cargo: { water: 0, tools: 0 },
    completedRounds: 0,
    lastLoad: null,
    result: null,
  };
}

export function trainRoundReducer(round: TrainRound, action: TrainAction): TrainRound {
  switch (action.type) {
    case 'start':
      return round.phase === 'ready' ? { ...round, phase: 'approach' } : round;
    case 'switch': {
      if (round.phase !== 'approach') return round;
      return { ...round, lane: round.lane === 'water' ? 'tools' : 'water' };
    }
    case 'lock':
      return round.phase === 'approach' ? { ...round, phase: 'locked', committedLane: round.lane } : round;
    case 'load': {
      const lane = round.committedLane;
      if (round.phase !== 'locked' || lane === null) return round;
      if (round.cargo[lane] >= round.order[lane]) return { ...round, phase: 'loading', lastLoad: null };
      return {
        ...round,
        phase: 'loading',
        cargo: { ...round.cargo, [lane]: round.cargo[lane] + 1 },
        lastLoad: lane,
      };
    }
    case 'check': {
      if (round.phase !== 'loading') return round;
      const completedRounds = round.completedRounds + 1;
      const filled = round.cargo.water === round.order.water && round.cargo.tools === round.order.tools;
      const shouldReturn = round.rule === 'three' ? completedRounds === 3 : filled;
      const result = shouldReturn ? (filled ? 'filled' : 'short') : null;
      return { ...round, phase: 'checking', completedRounds, result };
    }
    case 'continue':
      if (round.phase !== 'checking') return round;
      if (round.result !== null) return { ...round, phase: 'depot' };
      return { ...round, phase: 'approach', committedLane: null, lastLoad: null };
    case 'finish':
      return round.phase === 'depot' ? { ...round, phase: 'done' } : round;
  }
}
