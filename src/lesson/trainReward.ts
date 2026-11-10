import trainOrders from '../../train-orders.json';

export const TRAIN_ORDERS = trainOrders;
export const TRAIN_ORDER_INDICES = [0, 1, 2, 3, 4] as const;
export const TRAIN_LAP_LIMIT = 24;

export type CargoKind = 'water' | 'tools';
export type TrainOrderIndex = typeof TRAIN_ORDER_INDICES[number];
export type TrainRule = 'three' | 'fulfilled';
export type TrainPhase = 'ready' | 'approach' | 'locked' | 'loading' | 'checking' | 'depot' | 'done';
export type TrainResultInput = {
  orderIndex: TrainOrderIndex;
  rule: TrainRule;
  route: CargoKind[];
};

type Cargo = Record<CargoKind, number>;

export type TrainRound = TrainResultInput & {
  order: Readonly<Cargo & { name: string }>;
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
    route: [],
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
      if (round.phase !== 'loading' || round.committedLane === null) return round;
      const route = [...round.route, round.committedLane];
      const completedRounds = route.length;
      const filled = round.cargo.water === round.order.water && round.cargo.tools === round.order.tools;
      const shouldReturn = round.rule === 'three' ? completedRounds === 3 : filled || completedRounds === TRAIN_LAP_LIMIT;
      const result = shouldReturn ? (filled ? 'filled' : 'short') : null;
      return { ...round, phase: 'checking', route, completedRounds, result };
    }
    case 'continue':
      if (round.phase !== 'checking') return round;
      if (round.result !== null) return { ...round, phase: 'depot' };
      return { ...round, phase: 'approach', committedLane: null, lastLoad: null };
    case 'finish':
      return round.phase === 'depot' ? { ...round, phase: 'done' } : round;
  }
}
