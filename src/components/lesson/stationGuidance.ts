import type { CrossingPlan } from '../../lesson/model';

export type StationKind = 's1' | 's2b' | 's2c' | 's3';

type GuideTarget =
  | 'conditions' | 'flow' | 'run' | 'comparison' | 'comparisonReplay' | 'crossingCase'
  | 'temperature' | 'kettle' | 'nextQuestion' | 'duration' | 'reason' | 'playback' | 'check' | 'complete';

type GuideState = {
  playback: 'running' | 'paused' | 'idle';
  passed: boolean;
  needsRevision?: boolean;
  completionLabel: string;
} & (
  | { station: 's1'; plan: CrossingPlan; branch: 'yes' | 'no' | ''; selectedTested: boolean; bothTested: boolean }
  | { station: 's2b'; selected: boolean; viewed: boolean; edgeChosen: boolean }
  | { station: 's2c'; testedTemperatures: number; selectedTested: boolean; currentQuestion: number; choices: string[]; comparedTiming: boolean }
  | { station: 's3'; baseline: boolean; units: boolean; reason: boolean; reducedQueue?: boolean }
);

const regions: Record<GuideTarget, { selector: string; location: string }> = {
  conditions: { selector: '.condition-choices', location: '看底部的条件卡片区。' },
  flow: { selector: '.flow-board', location: '看右侧的流程板。' },
  run: { selector: '.primary-controls .simulate-button', location: '看底部的运行按钮。' },
  comparison: { selector: '.comparison-stage', location: '看中间两张流程图。' },
  comparisonReplay: { selector: '.primary-controls .simulate-button', location: '看底部的运行按钮。' },
  crossingCase: { selector: '.scene-tests', location: '看路口图下方的灯色情形区。' },
  temperature: { selector: '.scene-tests', location: '看热水壶下方的水温情形区。' },
  kettle: { selector: '.kettle-questions', location: '看底部的流程认读区。' },
  nextQuestion: { selector: '.kettle-questions .next-question', location: '看认读区的“下一项”按钮。' },
  duration: { selector: '.traffic-duration-choices', location: '看绿灯时长区。' },
  reason: { selector: '.reason-choices', location: '看时长旁边的理由区。' },
  playback: { selector: '.playback-controls', location: '看底部的暂停、继续和单步按钮。' },
  check: { selector: '.primary-controls .verify-button', location: '看底部的检查按钮。' },
  complete: { selector: '.primary-controls .complete-button', location: '看底部的绿色完成按钮。' },
};

function step(target: GuideTarget, hint: string) {
  return { target, hint, ...regions[target] };
}

export function getStationGuide(state: GuideState) {
  if (state.passed) return step('complete', `已验证，点“${state.completionLabel}”继续。`);
  if (state.playback === 'running') return step('playback', '观察当前执行步骤。想看仔细一点，可以点“暂停”。');
  if (state.playback === 'paused') return step('playback', '已暂停。点“继续”或“单步”，完成这次观察。');

  switch (state.station) {
    case 's1': {
      if (!state.plan.condition) return step('conditions', '先从下面选择判断条件。');
      if (state.branch) return step('flow', `点一个流程框，连接“${state.branch === 'yes' ? '是' : '否'}”。`);
      if (!state.plan.yes || !state.plan.no) return step('flow', `点“${!state.plan.yes ? '是' : '否'}”，再点这条箭头要去的流程框。`);
      if (state.needsRevision || state.bothTested) return step('flow', '沿着执行结果检查条件和箭头。修改流程后，再验证两种灯色。');
      if (state.selectedTested) return step('crossingCase', '当前情形已运行，切换到另一种灯色再验证。');
      return step('run', '点“运行”，观察这个灯色情形下行人怎样走。');
    }
    case 's2b':
      if (!state.selected) return step('comparison', '选一张流程图，看看它怎样执行。两张图都可以试。');
      if (!state.viewed) return step('comparisonReplay', '点“运行这张图”，沿着执行步骤观察。');
      if (state.needsRevision) return step('comparison', '根据刚才的观察，重新选图或点一条箭头，再检查判断。');
      if (!state.edgeChosen) return step('comparison', '点一条箭头作为依据，或选另一张图继续比较。');
      return step('check', '已经标出依据，点“检查我的判断”。');
    case 's2c': {
      if (state.testedTemperatures < 2) {
        return state.selectedTested
          ? step('temperature', '当前水温已运行，切换到另一种水温。')
          : step('run', '运行当前水温，观察读取、判断和加热的先后。');
      }
      if (state.needsRevision) return step('kettle', '对照刚才的运行结果，修改认读选项或先后预测。');
      if (state.choices.every(Boolean) && state.comparedTiming) return step('check', '三项都已完成，点“检查我的选择”。');
      if (state.currentQuestion < 2 && state.choices[state.currentQuestion]) return step('nextQuestion', '这一项已选择，点“下一项”继续。');
      if (state.currentQuestion === 2 && !state.comparedTiming) return step('kettle', '打开先后对照，先预测，再运行比较。');
      return step('kettle', '根据刚才的观察，完成底部还没选的认读项。');
    }
    case 's3':
      if (!state.baseline) return step('run', '先运行原方案，看一轮结果。');
      if (state.needsRevision) return state.reducedQueue
        ? step('reason', '这一侧排队变少了。检查你选的理由，再运行核对。')
        : step('duration', '这一侧排队还没有变少。改一下时长，再运行比较。');
      if (!state.units) return step('duration', '选择车多方向的绿灯时长。');
      if (!state.reason) return step('reason', '选择你调整时长的理由。');
      return step('run', '在相同车流条件下重新运行。');
  }
}
