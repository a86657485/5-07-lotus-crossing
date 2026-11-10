/** Lesson simulations use discrete teaching steps, not real road or appliance timings. */
export type ConditionId = 'cond_green_off' | 'cond_bridge' | 'cond_count' | 'act_as_diamond' | 'cond_arrive';
export type CrossingTarget = 'observe' | 'cross' | 'start' | 'end' | 'bridge';
export type CrossingCaseId = 'green_at_start' | 'red_then_green';
export interface CrossingPlan {
  condition: ConditionId | '';
  yes: CrossingTarget | '';
  no: CrossingTarget | '';
}
export interface TraceStep {
  nodeId: string;
  label: string;
  light?: 'red' | 'green';
  person?: 'waiting' | 'crossing' | 'stopped' | 'on_bridge' | 'counting';
  temperature?: number;
  heating?: boolean;
  position?: number;
  carsPassed?: number;
  carsWaiting?: number;
  elapsedUnits?: number;
  observations?: number;
}
export interface CrossingRun {
  caseId: CrossingCaseId;
  trace: TraceStep[];
  outcome: 'incomplete' | 'not_a_condition' | 'crossed_green' | 'red_blocked' | 'ended_at_curb' | 'step_limit' | 'took_bridge';
  correct: boolean;
  observations: number;
}

const conditions: string[] = ['cond_green_off', 'cond_bridge', 'cond_count', 'act_as_diamond', 'cond_arrive'];
const targets: string[] = ['observe', 'cross', 'start', 'end', 'bridge'];

export function normalizeCrossingPlan(value: unknown): CrossingPlan {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    condition: conditions.includes(String(source.condition)) ? source.condition as ConditionId : '',
    yes: targets.includes(String(source.yes)) ? source.yes as CrossingTarget : '',
    no: targets.includes(String(source.no)) ? source.no as CrossingTarget : '',
  };
}

export function isCrossingPlanCorrect(plan: CrossingPlan): boolean {
  return plan.condition === 'cond_green_off' && plan.yes === 'observe' && plan.no === 'cross';
}

/** Phase A trial order: every card is run once before students formalize the loop. */
export const FIVE_CONDITION_ORDER: ConditionId[] = ['cond_bridge', 'cond_count', 'act_as_diamond', 'cond_arrive', 'cond_green_off'];

/** Default yes/no arrows used while demonstrating each condition card. */
export const FIVE_CONDITION_DEMO_ARROWS: Record<ConditionId, { yes: CrossingTarget | ''; no: CrossingTarget | '' }> = {
  cond_bridge: { yes: 'bridge', no: 'cross' },
  cond_count: { yes: 'end', no: 'observe' },
  act_as_diamond: { yes: '', no: '' },
  cond_arrive: { yes: 'end', no: 'cross' },
  cond_green_off: { yes: 'observe', no: 'cross' },
};

export const FIVE_CONDITION_FEEDBACK: Record<ConditionId, string> = {
  cond_bridge: '走了天桥，这是选路，不是再等一次。',
  cond_count: '数满三次就停了，没问灯还红不红。',
  act_as_diamond: '这是动作，不能回答“是”或“否”。',
  cond_arrive: '人还在路沿，这个问题问早了。',
  cond_green_off: '灯还没绿就再看；绿了再过。',
};

export function nextUntestedCondition(tested: readonly string[]): ConditionId | null {
  return FIVE_CONDITION_ORDER.find(id => !tested.includes(id)) ?? null;
}

export function allFiveConditionsTested(tested: readonly string[]): boolean {
  return FIVE_CONDITION_ORDER.every(id => tested.includes(id));
}

export function crossingLightAt(caseId: CrossingCaseId, elapsedUnits: number, redDuration = 9): 'red' | 'green' {
  return caseId === 'green_at_start' || elapsedUnits >= redDuration ? 'green' : 'red';
}

export function simulateCrossing(input: CrossingPlan, caseId: CrossingCaseId, options: { redDuration?: number } = {}): CrossingRun {
  const plan = normalizeCrossingPlan(input);
  const redDuration = Math.max(1, Math.min(16, Math.floor(options.redDuration ?? 9)));
  const trace: TraceStep[] = [];
  let light: 'red' | 'green' = caseId === 'green_at_start' ? 'green' : 'red';
  let observations = 0;
  let current: CrossingTarget | 'decide' = 'start';
  const finish = (outcome: CrossingRun['outcome']): CrossingRun => ({
    caseId, trace, outcome, observations,
    correct: outcome === 'crossed_green' && isCrossingPlanCorrect(plan),
  });
  // “原地观察红绿灯” is an action, not a yes/no question, so it can run without arrows.
  if (!plan.condition || (plan.condition !== 'act_as_diamond' && (!plan.yes || !plan.no))) {
    trace.push({ nodeId: 'decide', label: '先补好判断和两条箭头，再运行。', light, person: 'waiting' });
    return finish('incomplete');
  }
  const counting = plan.condition === 'cond_count';
  for (let step = 0; step < 24; step++) {
    // The signal has its own fixed clock; changing an observation count never changes it.
    light = crossingLightAt(caseId, step, redDuration);
    const state = { light, elapsedUnits: step };
    if (current === 'start') {
      trace.push({ nodeId: 'start', label: '灯按模拟时间变化，观察不会让灯变绿。', ...state, person: counting ? 'counting' : 'waiting', observations });
      current = 'observe';
    } else if (current === 'observe') {
      observations++;
      trace.push({ nodeId: 'observe', label: `模拟时间${step}格：观察到${light === 'green' ? '绿' : '红'}灯。`, ...state, person: counting ? 'counting' : 'waiting', observations });
      current = 'decide';
    } else if (current === 'decide') {
      if (plan.condition === 'act_as_diamond') {
        trace.push({ nodeId: 'decide', label: '这是一个动作，不能回答“是”或“否”。', ...state, person: 'waiting', observations });
        return finish('not_a_condition');
      }
      const answer = plan.condition === 'cond_green_off' ? light !== 'green'
        : plan.condition === 'cond_count' ? observations >= 3
        : plan.condition === 'cond_bridge' ? true
        : false;
      const person = counting ? 'counting' as const : 'waiting' as const;
      trace.push({ nodeId: 'decide', label: `判断结果是“${answer ? '是' : '否'}”，沿这条箭头走。`, ...state, person, observations });
      current = (answer ? plan.yes : plan.no) as CrossingTarget;
    } else if (current === 'cross') {
      if (light === 'red') {
        trace.push({ nodeId: 'cross', label: '红灯还亮着，行人在路沿安全停下。', ...state, person: 'stopped', observations });
        return finish('red_blocked');
      }
      trace.push({ nodeId: 'cross', label: '绿灯亮，行人通过斑马线。', ...state, person: 'crossing', observations });
      trace.push({ nodeId: 'end', label: '到达马路对面。', ...state, person: 'crossing', observations });
      return finish('crossed_green');
    } else if (current === 'bridge') {
      trace.push({ nodeId: 'bridge', label: '走向天桥楼梯。', ...state, person: 'on_bridge', position: 1, observations });
      trace.push({ nodeId: 'bridge', label: '沿楼梯走上天桥。', ...state, person: 'on_bridge', position: 2, observations });
      trace.push({ nodeId: 'end', label: '从天桥走到对面。这是选路，不是再等一次。', ...state, person: 'on_bridge', position: 3, observations });
      return finish('took_bridge');
    } else {
      trace.push({ nodeId: 'end', label: '流程结束了，行人却还在路沿。', ...state, person: counting ? 'counting' : 'waiting', observations });
      return finish('ended_at_curb');
    }
  }
  trace.push({ nodeId: current, label: '流程一直绕圈，暂停检查条件和箭头。', light, person: 'waiting' });
  return finish('step_limit');
}

export function simulateKettle(initial: 80 | 100): TraceStep[] {
  if (initial !== 80 && initial !== 100) throw new RangeError('请选择80℃或100℃教学情形');
  let temperature: number = initial;
  const trace: TraceStep[] = [{ nodeId: 'start', label: '接通热水壶，先看看水温。', temperature, heating: false }];
  while (true) {
    trace.push({ nodeId: 'check', label: `读取水温：${temperature}℃。读取不会改变水温。`, temperature, heating: false });
    trace.push({ nodeId: 'decide', label: `水温低于100℃？${temperature < 100 ? '是，继续加热。' : '否，停止加热。'}`, temperature, heating: false });
    if (temperature >= 100) break;
    temperature += 10;
    trace.push({ nodeId: 'heat', label: `加热一小段，水温升到${temperature}℃。`, temperature, heating: true });
  }
  trace.push({ nodeId: 'stop', label: '达到100℃，停止加热。', temperature, heating: false });
  trace.push({ nodeId: 'end', label: '这一轮烧水结束。', temperature, heating: false });
  return trace;
}

export type TrafficUnits = 3 | 6 | 9;
export function simulateTraffic(greenUnits: TrafficUnits) {
  if (![3, 6, 9].includes(greenUnits)) throw new RangeError('请选择3、6或9格教学时长');
  const initialCars = 12;
  const pedestrianUnits = 6;
  const trace: TraceStep[] = [{ nodeId: 'start', label: '同一方向有12辆车等待。', light: 'red', carsPassed: 0, carsWaiting: initialCars }];
  for (let passed = 1; passed <= greenUnits; passed++) {
    trace.push({ nodeId: 'green', label: `放行第${passed}格：通过${passed}辆，还等${initialCars - passed}辆。`, light: 'green', carsPassed: passed, carsWaiting: initialCars - passed });
  }
  trace.push({ nodeId: 'pedestrian', label: '行人阶段保持6格。这里的时间已缩短。', light: 'red', carsPassed: greenUnits, carsWaiting: initialCars - greenUnits });
  trace.push({ nodeId: 'end', label: `本轮通过${greenUnits}辆，还等${initialCars - greenUnits}辆。`, light: 'red', carsPassed: greenUnits, carsWaiting: initialCars - greenUnits });
  return { greenUnits, initialCars, passedCars: greenUnits, remainingCars: initialCars - greenUnits, pedestrianUnits, otherDirectionWaitUnits: greenUnits, trace };
}

export function isTrafficReasonCorrect(reason: string): boolean {
  return reason === 'rs_evacuate';
}

export type MazeConditionId = 'not_at_goal' | 'at_goal' | 'steps_three';
export interface MazePlan { condition: MazeConditionId | ''; action: 'forward' | 'wait' | '' }
export function simulateMaze(plan: MazePlan, length: 3 | 5) {
  if (length !== 3 && length !== 5) throw new RangeError('请选择短步道或长步道');
  const trace: TraceStep[] = [];
  let position = 0;
  let outcome: 'arrived' | 'stopped_early' | 'step_limit' | 'incomplete' = 'step_limit';
  if (!plan.condition || !plan.action) return { trace, position, outcome: 'incomplete' as const, correct: false };
  for (let step = 0; step < 12; step++) {
    const repeat = plan.condition === 'not_at_goal' ? position < length
      : plan.condition === 'at_goal' ? position === length : position >= 3;
    trace.push({ nodeId: 'decide', label: `判断结果：“${repeat ? '是' : '否'}”。`, position });
    if (!repeat) {
      outcome = position === length ? 'arrived' : 'stopped_early';
      trace.push({ nodeId: 'end', label: outcome === 'arrived' ? '到达检查点，停止。' : '小车还没到检查点就停止了。', position });
      break;
    }
    if (plan.action === 'forward') {
      position = Math.min(length, position + 1);
      trace.push({ nodeId: 'move', label: '前进一步，再回去判断。', position });
    } else {
      trace.push({ nodeId: 'wait', label: '原地等待，位置没有改变。', position });
    }
  }
  if (outcome === 'step_limit') trace.push({ nodeId: 'end', label: '小车一直重复，暂停检查规则。', position });
  return { trace, position, outcome, correct: outcome === 'arrived' && plan.condition === 'not_at_goal' && plan.action === 'forward' };
}
