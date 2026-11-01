import { GateState, S3State, StationProgress, TaskId } from '../types';

export function getGateState(
  targetTask: TaskId,
  progress: StationProgress,
  s3State?: S3State
): GateState {
  if (targetTask === 's1_order') {
    return progress.s1_order ? 'verified_ready' : 'pre_done_unverified';
  }

  if (targetTask === 's2_rewrite' || targetTask === 's2_vs_branch' || targetTask === 's2_kettle') {
    if (!progress.s1_order) return 'pre_missing';
    if (progress[targetTask]) return 'verified_ready';
    return 'pre_done_unverified';
  }

  if (targetTask === 's3_timing') {
    const s2AllDone = progress.s2_rewrite && progress.s2_vs_branch && progress.s2_kettle;
    if (!s2AllDone) return 'pre_missing';
    if (progress.s3_timing) return 'verified_ready';

    if (s3State?.faultObserved && (!s3State.ruleChanged || !s3State.revalidateOk)) {
      return 'pre_done_unverified';
    }
    return 'pre_done_unverified';
  }

  if (targetTask === 'exam') {
    const s1Ok = progress.s1_order;
    const s2Ok = progress.s2_rewrite && progress.s2_vs_branch && progress.s2_kettle;
    const s3Ok = progress.s3_timing;
    if (s1Ok && s2Ok && s3Ok) {
      return progress.exam ? 'verified_ready' : 'verified_ready';
    }
    return 'pre_missing';
  }

  return 'pre_missing';
}

export function getRelicHint(
  currentTask: TaskId,
  subTask?: string,
  s3State?: S3State
): string {
  if (currentTask === 's1_order') {
    return '先仔细找哪一步在原地等待，观察信号灯的变化。';
  }

  if (currentTask === 's2_rewrite') {
    return '菱形必须是能答「是或否」的问句，回边箭头要指回反复做的那一步。';
  }

  if (currentTask === 's2_vs_branch') {
    return '两张图都有菱形，但分支只选一条路走一次，循环是还要不要再做一遍。';
  }

  if (currentTask === 's2_kettle') {
    return '保温壶先测水温再决定是否加热，看看是先问还是先做。';
  }

  if (currentTask === 's3_timing') {
    // CRITICAL HARD RULE: If already observed fault, NEVER say "再跑一遍故障"
    if (s3State?.faultObserved) {
      return '路口已经堵住啦，请在下方点击选择更合理的时长策略与理由，再运行核对！';
    }
    return '先点击「运行路口」，看看预设的时长为什么会引发拥堵。';
  }

  return '按照小交警任务单指引，一步步仔细观察。';
}
