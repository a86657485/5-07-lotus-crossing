import type { TrafficUnits } from '../../lesson/model';

type Evidence = { eventId?: string; taskId?: string; eventType?: string; correct?: boolean | null; payload?: Record<string, any> };
type RestoreInput = { taskId: string; draft?: Record<string, any>; initialS3?: Record<string, any>; evidence?: Evidence[]; freshStart?: boolean; resetId?: string };
export type LessonStation = 's1' | 's2b' | 's2c' | 's3';

export function trafficUnits(value: unknown): TrafficUnits | null {
  return value === 3 || value === 6 || value === 9 ? value : null;
}

/** A restart clears the current arrangement; prior support and first answers remain evidence. */
export function restoreStationState(input: RestoreInput) {
  const all = (input.evidence || []).filter(e => e.taskId === input.taskId);
  let resetIndex = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].eventType === 'station_reset') { resetIndex = i; break; }
  }
  const lastReset = all[resetIndex];
  const sourceDraft = input.draft || {};
  const serverResetId = lastReset?.payload?.resetId || lastReset?.eventId || '';
  const resetId = input.resetId || serverResetId || sourceDraft.resetId || '';
  const draftMatches = !resetId || sourceDraft.resetId === resetId;
  const draft = !input.freshStart && draftMatches ? sourceDraft : {};
  const pendingReset = !!input.resetId && input.resetId !== serverResetId;
  const afterReset = input.freshStart || pendingReset ? [] : all.slice(resetIndex + 1);
  const runs = afterReset.filter(e => e.eventType === 'simulation_run' && e.payload).map(e => e.payload!);
  // The legacy summary has no generation. It is usable only before any explicit reset.
  const legacy = !input.freshStart && resetIndex < 0 && !input.resetId ? input.initialS3 || {} : {};
  const history = runs.length ? runs : Array.isArray(legacy.runHistory) ? legacy.runHistory : [];
  const last = [...history].reverse().find(e => e.kind === 'attempt');
  const strategy = legacy.strategy;
  const savedUnits = strategy === 'st_car_long' ? 6 : strategy === 'st_longest' ? 9 : strategy === 'st_same' ? 3 : null;
  const failedAttempts = all.filter(e => (e.correct === false || e.payload?.correct === false) && (
    e.eventType === 'attempt' || e.eventType === 'evidence_attempt' ||
    (e.eventType === 'simulation_run' && e.payload?.kind === 'attempt')
  )).length;
  const scaffoldErrors = all.reduce((count, e) => Number.isFinite(e.payload?.errorCount) ? Math.max(count, Math.max(0, Math.floor(e.payload!.errorCount))) : count, 0);
  return {
    draft,
    resetId,
    history,
    baseline: !input.freshStart && (!!legacy.faultObserved || history.length > 0),
    units: trafficUnits(draft.units) || trafficUnits(last?.greenUnits) || savedUnits,
    reason: draft.reason ?? last?.reason ?? legacy.reason ?? '',
    lastRun: history[history.length - 1],
    supportUsed: sourceDraft.supportUsed === true || all.some(e => e.payload?.supportUsed === true),
    errorCount: Math.max(Number.isFinite(sourceDraft.errorCount) ? Math.max(0, Math.floor(sourceDraft.errorCount)) : 0, failedAttempts, scaffoldErrors),
  };
}

export function scaffoldFor(station: LessonStation, errorCount: number) {
  const level = Math.min(3, Math.max(1, Math.floor(errorCount)));
  const messages: Record<LessonStation, [string, string, string]> = {
    s1: [
      '沿刚才的执行光点看：哪一步重复了，哪一步该离开？',
      '重点看判断后的两条箭头：哪条会回去，哪条会离开？',
      '换个例子：书还没借齐，就再借一本，再检查。想想怎样让“再做”接着一次判断。',
    ],
    s2b: [
      '先看一次执行会经过哪些步骤，有步骤再次出现吗？',
      '把目光放在箭头上，看看它会不会回到做过的步骤。',
      '换个例子：反复检查“轮到我了吗”是再做；决定去图书馆还是操场，是选一条路。',
    ],
    s2c: [
      '再看一轮水温变化，留意真正加热的时刻。',
      '读取只是看水温，不会升温。比较两种初始水温的第一步。',
      '换个例子：先看电量，再决定是否充电；电量够时可以一次也不充。对照壶图的先后。',
    ],
    s3: [
      '比较运行前后：这一侧还等多少辆？另一侧又等多久？',
      '这次只要求缓解当前排队；结合车流选择方案和理由，行人阶段保持不变。',
      '换个例子：校门一侧排队较多，多给通行时间能让它多走一些，另一侧也会多等。再看你的比较结果。',
    ],
  };
  return { level, text: messages[station][level - 1] };
}
