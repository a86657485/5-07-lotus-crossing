import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamEvaluationResult, LearningEvidence } from '../../types';
import { apiSetClassExamPaused, apiTeacher, teacherExportUrl, type TeacherPayload } from '../../api/client';

type Pupil = TeacherPayload['students'][number];
type SortField = 'classId' | 'name' | 'lastSync' | 'first' | 'latest' | 'support';
type SortKey = { field: SortField; ascending: boolean };
type ScoreRange = { min: string; max: string };

const classIds = ['501', '502', '503', '504'];
const control = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline focus:outline-2 focus:outline-sky-400';
const button = 'rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sky-400 disabled:opacity-50';
const panel = 'bg-slate-800/80 border border-slate-700 rounded-xl p-4';
const taskNames: Record<string, string> = {
  s1_order: '第一站 过街顺序',
  s2_rewrite: '第一站 过街流程图',
  s2_vs_branch: '第二站 比较分支与循环',
  s2_kettle: '第二站 热水壶',
  s3_timing: '第三站 调度',
};
const eventNames: Record<string, string> = {
  attempt: '尝试',
  evidence_attempt: '尝试',
  case_run: '情形运行',
  scenario_run: '模拟运行',
  simulation_run: '模拟运行',
  evidence_lock: '完成确认',
  station_reset: '重做',
  current_invalidated: '修改方案',
};
const attemptNames: Record<string, string> = {
  first: '首答', revision: '修订', process: '过程', confirmation: '确认', unknown: '次数不明',
};
const misconceptions: Record<string, string> = {
  M1: '混淆循环和分支',
  M2: '认为必须先确定重复次数',
  M3: '混淆条件与动作',
  M4: '未找准反复步骤',
  M5: '混淆判断与执行的先后',
  M6: '混淆顺序、分支与循环',
};

const firstResult = (row: Pupil) => row.examFirstComplete ? row.examFirstResult || row.examResult : null;
const recentResult = (row: Pupil) => row.examLatestComplete ? row.examLatestResult || firstResult(row) : firstResult(row);
const secondStationDone = (row: Pupil) => row.stations.s2_rewrite && row.stations.s2_vs_branch && row.stations.s2_kettle;

function getEvidence(row: Pupil) {
  const entries = new Map<string, LearningEvidence>();
  for (const item of [...(row.evidenceHistory || []), ...(row.evidence || [])]) {
    if (taskNames[item.taskId]) entries.set(item.eventId, item);
  }
  return [...entries.values()].sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
}

function hasConceptSupport(row: Pupil, evidence: LearningEvidence[]) {
  return row.relics.used > 0 || evidence.some(item =>
    item.payload?.supportUsed === true || item.payload?.kind === 'concept_support' || item.payload?.kind === 'error_scaffold'
  );
}

function scoreLabel(result: ExamEvaluationResult | null | undefined) {
  return result ? `${result.baseScore} / ${result.baseTotal}` : '尚无考核记录';
}

function goalLabel(result: ExamEvaluationResult | null | undefined) {
  if (!result) return '尚无考核记录';
  return `G1 ${result.g1Score}/${result.g1Total} · G2 ${result.g2Score}/${result.g2Total}`;
}

function inRange(score: number | undefined, range: ScoreRange) {
  if (!range.min && !range.max) return true;
  if (score === undefined) return false;
  return (!range.min || score >= Number(range.min)) && (!range.max || score <= Number(range.max));
}

function sortValue(row: Pupil, field: SortField): string | number {
  switch (field) {
    case 'classId': return row.student.classId;
    case 'name': return row.student.name;
    case 'lastSync': return row.lastSync || '';
    case 'first': return firstResult(row)?.baseScore ?? 0;
    case 'latest': return recentResult(row)?.baseScore ?? 0;
    case 'support': return row.relics.used;
  }
}

function compareRows(a: Pupil, b: Pupil, sorting: SortKey[]) {
  if (!!firstResult(a) !== !!firstResult(b)) return firstResult(a) ? -1 : 1;
  for (const key of sorting) {
    const left = sortValue(a, key.field), right = sortValue(b, key.field);
    const order = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, 'zh-CN')
      : Number(left) - Number(right);
    if (order) return key.ascending ? order : -order;
  }
  return a.student.studentId.localeCompare(b.student.studentId);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '尚无记录';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function PupilEvidence({ row, evidence }: { row: Pupil; evidence: LearningEvidence[] }) {
  const latest = recentResult(row);
  const problems = latest?.details.filter(item => !item.correct) || [];
  const required = evidence.filter(item => item.payload?.optional !== true && item.payload?.scenario !== 'maze_transfer');
  const optional = evidence.filter(item => item.payload?.optional === true || item.payload?.scenario === 'maze_transfer');
  return <div className="grid gap-3 md:grid-cols-3 p-2">
    <section>
      <h3 className="font-semibold mb-1">成绩与目标</h3>
      <p>首答 {scoreLabel(firstResult(row))} · {goalLabel(firstResult(row))}</p>
      <p>最近 {scoreLabel(latest)} · {goalLabel(latest)}</p>
      {row.incompleteScores?.base !== undefined && <p>旧不完整基础卷 {row.incompleteScores.base} 分 · 历史记录</p>}
      {row.incompleteScores?.challenge !== undefined && <p>旧不完整挑战卷 {row.incompleteScores.challenge} 分 · 历史记录</p>}
      <p>最近同步 {formatTime(row.lastSync)}</p>
      <p>法宝 {row.relics.used} / 3 次</p>
      <p>{row.examOpen ? '已取得开考资格' : '尚未开考'}</p>
    </section>
    <section>
      <h3 className="font-semibold mb-1">最近的必做探究证据</h3>
      {required.length ? <ul className="space-y-1">{required.slice(0, 5).map(item =>
        <li key={item.eventId}>
          {taskNames[item.taskId]} · {eventNames[item.eventType] || '操作记录'} · {attemptNames[item.attemptKind || 'unknown']}
          {item.payload?.supportUsed === true ? ' · 获得支持' : ''}
          {item.correct == null ? '' : item.correct ? ' · 符合预期' : ' · 待修正'}
          <span className="block text-slate-400">{formatTime(item.receivedAt)}</span>
        </li>
      )}</ul> : <p>尚无证据</p>}
      <p className="mt-2">选做巡检记录 {optional.length || '尚无证据'}</p>
    </section>
    <section>
      <h3 className="font-semibold mb-1">最近考核待巩固</h3>
      {problems.length ? <ul className="space-y-1">{problems.map(item => <li key={item.questionId}>
        {item.questionId} · {(item.misconceptionIds || (item.misconceptionId ? [item.misconceptionId] : []))
          .map(id => misconceptions[id] || id).join('、') || '未分类'}
      </li>)}</ul> : <p>{latest?.details.length ? '本次没有错题' : '尚无逐题证据'}</p>}
    </section>
  </div>;
}

export const TeacherDashboardView: React.FC<{ onBackToApp?: () => void }> = ({ onBackToApp }) => {
  const [selectedClass, setSelectedClass] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [passFilter, setPassFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [supportFilter, setSupportFilter] = useState('all');
  const [firstRange, setFirstRange] = useState<ScoreRange>({ min: '', max: '' });
  const [latestRange, setLatestRange] = useState<ScoreRange>({ min: '', max: '' });
  const [sorting, setSorting] = useState<SortKey[]>([{ field: 'classId', ascending: true }]);
  const [addSort, setAddSort] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payload, setPayload] = useState<TeacherPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++latestRequest.current;
    setLoading(true);
    try {
      // Whole-grade data remains the basis for the header even when the table is filtered.
      const result = await apiTeacher();
      if (id !== latestRequest.current) return;
      setPayload(result);
      setLoadError('');
    } catch (error) {
      if (id !== latestRequest.current) return;
      setLoadError(error instanceof Error ? error.message : '教师数据加载失败');
    } finally {
      if (id === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => { window.clearInterval(timer); latestRequest.current++; };
  }, [refresh]);

  const evidenceByPupil = useMemo(() =>
    new Map((payload?.students || []).map(row => [row.student.studentId, getEvidence(row)])), [payload]);

  const rows = useMemo(() => {
    const query = searchQuery.trim();
    return (payload?.students || []).filter(row => {
      if (selectedClass !== 'all' && row.student.classId !== selectedClass) return false;
      if (query && !row.student.name.includes(query)) return false;
      const first = firstResult(row);
      if (passFilter === 'passed' && !first?.passed) return false;
      if (passFilter === 'failed' && (!first || first.passed)) return false;
      if (passFilter === 'no_record' && first) return false;
      if (targetFilter !== 'all') {
        const [goal, status] = targetFilter.split(':');
        const score = goal === 'g1' ? first?.g1Score : first?.g2Score;
        const total = goal === 'g1' ? first?.g1Total : first?.g2Total;
        if (score === undefined || !total) return false;
        if ((score >= Math.ceil(total / 2)) !== (status === 'met')) return false;
      }
      const evidence = evidenceByPupil.get(row.student.studentId) || [];
      if (evidenceFilter === 'recorded' && !evidence.length) return false;
      if (evidenceFilter === 'none' && evidence.length) return false;
      if (evidenceFilter === 'revision' && !evidence.some(item => item.attemptKind === 'revision')) return false;
      if (evidenceFilter === 'confirmed' && !evidence.some(item => item.eventType === 'evidence_lock' && item.correct === true)) return false;
      if (supportFilter !== 'all' && hasConceptSupport(row, evidence) !== (supportFilter === 'used')) return false;
      return inRange(first?.baseScore, firstRange) && inRange(recentResult(row)?.baseScore, latestRange);
    }).sort((a, b) => compareRows(a, b, sorting));
  }, [payload, evidenceByPupil, selectedClass, searchQuery, passFilter, targetFilter, evidenceFilter, supportFilter, firstRange, latestRange, sorting]);

  function changeSort(field: SortField, append: boolean) {
    setSorting(old => {
      const previous = old.find(item => item.field === field);
      const key = { field, ascending: previous ? !previous.ascending : true };
      if (!append) return [key];
      if (previous) return old.map(item => item.field === field ? key : item);
      return [...old, key];
    });
  }

  function sortHeader(field: SortField, label: string) {
    const index = sorting.findIndex(item => item.field === field);
    const key = sorting[index];
    return <th className="px-3 py-3" aria-sort={index === 0 ? key.ascending ? 'ascending' : 'descending' : undefined}>
      <button className="hover:text-white focus:outline focus:outline-2 focus:outline-sky-400" onClick={e => changeSort(field, addSort || e.shiftKey)}>
        {label}{key && ` ${index + 1}${key.ascending ? '↑' : '↓'}`}
      </button>
    </th>;
  }

  async function toggleExam() {
    if (!payload?.canManageExam || selectedClass === 'all' || saving) return;
    const classId = selectedClass;
    setSaving(true);
    setOperationMessage('');
    try {
      const result = await apiSetClassExamPaused(classId, !payload.examPauses[classId]);
      setPayload(previous => previous && { ...previous, examPauses: { ...previous.examPauses, [classId]: result.closed } });
      setOperationMessage(`${classId} 班考核已${result.closed ? '暂停' : '重新开放'}。`);
      await refresh();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : '操作失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  const summary = payload?.summary;
  const total = summary?.total ?? 0;
  const overview: Array<[string, number]> = [
    ['已进入', summary?.entered ?? 0], ['第一站完成', summary?.s1 ?? 0],
    ['第二站完成', summary?.s2 ?? 0], ['第三站完成', summary?.s3 ?? 0],
    ['基础首答达标', summary?.examPassed ?? 0], ['挑战加分', summary?.challengeBonus ?? 0],
  ];
  const bars: Array<[string, number]> = [
    ['已进入', rows.filter(row => row.entered).length],
    ['第一站完成', rows.filter(row => row.stations.s1_order).length],
    ['第二站完成', rows.filter(secondStationDone).length],
    ['第三站完成', rows.filter(row => row.stations.s3_timing).length],
    ['基础首答达标', rows.filter(row => firstResult(row)?.passed).length],
  ];

  return <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold">五年级第7课 · 莲花山智慧路口教师大屏</h1>
        <p className="text-sm text-slate-400 mt-1" aria-live="polite">{loadError || (loading ? '正在同步…' : `更新于 ${formatTime(payload?.updatedAt)}`)}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => void refresh()}>立即刷新</button>
        <a className={button} href={teacherExportUrl(selectedClass === 'all' ? undefined : selectedClass)} download>导出课堂 CSV</a>
        {onBackToApp && <button className={button} onClick={onBackToApp}>返回学生端</button>}
      </div>
    </header>

    <section aria-label="全年级固定概览">
      <h2 className="text-sm font-semibold mb-2">全年级概览</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {overview.map(([label, count]) => <div key={label} className={panel}><p className="text-sm text-slate-400">{label}</p>
          <p className="text-xl font-bold text-amber-200 mt-1">{summary ? `${count} / ${total}` : '—'}</p></div>)}
      </div>
      <p className="mt-2 text-xs text-slate-400">概览以全年级在册人数为分母。考核达标依据基础首答，挑战另记。</p>
    </section>

    <section aria-label="筛选与考核管理" className={panel}>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <select aria-label="班级" className={control} value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setOperationMessage(''); }}>
          <option value="all">全部班级</option>{classIds.map(id => <option key={id} value={id}>{id} 班</option>)}
        </select>
        <input aria-label="学生姓名" className={control} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索姓名" />
        <select aria-label="考核状态" className={control} value={passFilter} onChange={e => setPassFilter(e.target.value)}>
          <option value="all">全部考核状态</option><option value="passed">已达标</option><option value="failed">未达标</option><option value="no_record">尚无考核记录</option>
        </select>
        <select aria-label="首答目标" className={control} value={targetFilter} onChange={e => setTargetFilter(e.target.value)}>
          <option value="all">全部首答目标</option><option value="g1:met">G1 达到一半</option><option value="g1:below">G1 待巩固</option><option value="g2:met">G2 达到一半</option><option value="g2:below">G2 待巩固</option>
        </select>
        <select aria-label="探究证据" className={control} value={evidenceFilter} onChange={e => setEvidenceFilter(e.target.value)}>
          <option value="all">全部探究证据</option><option value="recorded">已有证据</option><option value="none">尚无证据</option><option value="revision">有修订记录</option><option value="confirmed">有完成确认</option>
        </select>
        <select aria-label="概念支持" className={control} value={supportFilter} onChange={e => setSupportFilter(e.target.value)}>
          <option value="all">全部支持状态</option><option value="used">有概念支持记录</option><option value="none">尚无支持记录</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 items-center text-sm">
        {([{ title: '首答分数', range: firstRange, change: setFirstRange }, { title: '最近分数', range: latestRange, change: setLatestRange }]).map(({ title, range, change }) =>
          <div key={title} className="flex items-center gap-1"><span>{title}</span>
            <input aria-label={`${title}下限`} className={`${control} w-16`} type="number" min={0} max={16} value={range.min} onChange={e => change({ ...range, min: e.target.value })} />
            <span>到</span>
            <input aria-label={`${title}上限`} className={`${control} w-16`} type="number" min={0} max={16} value={range.max} onChange={e => change({ ...range, max: e.target.value })} />
          </div>)}
        <label className="flex items-center gap-2"><input type="checkbox" checked={addSort} onChange={e => setAddSort(e.target.checked)} />叠加排序</label>
        <button className={button} onClick={() => setSorting([{ field: 'classId', ascending: true }])}>重置排序</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">{selectedClass === 'all' ? '选择班级查看考核开关' : `${selectedClass} 班考核${payload?.examPauses[selectedClass] ? '已暂停' : '开放'}`}</span>
        {selectedClass !== 'all' && payload?.canManageExam && <button className={button} disabled={saving} onClick={() => void toggleExam()}>
          {saving ? '正在保存…' : payload.examPauses[selectedClass] ? '重新开放本班考核' : '暂停本班考核'}
        </button>}
        {payload && !payload.canManageExam && <span className="text-xs text-slate-400">考核开关在运行课堂服务的电脑上操作，请打开本机 localhost 教师大屏。</span>}
        {operationMessage && <span className="text-sm" role="status">{operationMessage}</span>}
      </div>
    </section>

    <section className={panel} aria-label="筛选结果图表">
      <h2 className="text-sm font-semibold mb-2">筛选结果 · {rows.length} 人</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{bars.map(([label, count]) => <div key={label}>
        <div className="flex justify-between gap-1 text-xs mb-1"><span>{label}</span><span>{count}/{rows.length}</span></div>
        <div className="h-2 rounded bg-slate-700 overflow-hidden" aria-hidden="true"><div className="h-full bg-sky-500" style={{ width: `${rows.length ? count / rows.length * 100 : 0}%` }}/></div>
      </div>)}</div>
    </section>

    <section aria-label="学生明细" className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-left text-sm min-w-[860px]">
        <thead className="bg-slate-800 text-slate-300"><tr>
          {sortHeader('classId', '班级')}{sortHeader('name', '姓名')}<th className="px-3">进入情况</th><th className="px-3">三站</th>
          {sortHeader('first', '基础首答')}{sortHeader('latest', '基础最近')}<th className="px-3">首答目标</th>
          <th className="px-3">达标</th><th className="px-3">挑战</th>{sortHeader('support', '法宝')}{sortHeader('lastSync', '最近同步')}<th className="px-3">证据</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800">{rows.map(row => {
          const first = firstResult(row), latest = recentResult(row);
          const id = row.student.studentId, open = expanded === id;
          const secondDone = secondStationDone(row);
          const completed = [row.stations.s1_order, secondDone, row.stations.s3_timing].filter(Boolean).length;
          const challenge = row.challengeFirstComplete ? row.challengeFirstResult : null;
          return <React.Fragment key={id}>
            <tr className="hover:bg-slate-800/50">
              <td className="px-3 py-2">{row.student.classId}</td><td className="px-3 font-semibold">{row.student.name}</td>
              <td className="px-3">{row.entered ? '已进入' : '未进入'}</td>
              <td className="px-3" title={`第一站${row.stations.s1_order ? '完成' : '尚无完成记录'} · 第二站${secondDone ? '完成' : '尚无完成记录'} · 第三站${row.stations.s3_timing ? '完成' : '尚无完成记录'}`}>{completed} / 3</td>
              <td className="px-3">{!first && row.incompleteScores?.base !== undefined ? '旧卷未填完整' : scoreLabel(first)}</td><td className="px-3">{scoreLabel(latest)}</td><td className="px-3">{goalLabel(first)}</td>
              <td className="px-3">{first ? first.passed ? '达标' : '未达标' : '—'}</td>
              <td className="px-3">{challenge ? `${challenge.challengeScore ?? 0}/${challenge.challengeTotal ?? 6}${challenge.challengePassed ? ' · 加分' : ''}` : '尚无记录'}</td>
              <td className="px-3">{row.entered ? `${row.relics.used} / 3` : '—'}</td>
              <td className="px-3 whitespace-nowrap">{formatTime(row.lastSync)}</td>
              <td className="px-3"><button className="text-sky-300 underline focus:outline focus:outline-2 focus:outline-sky-400" aria-expanded={open} aria-label={`${open ? '收起' : '查看'}${row.student.name}明细`} onClick={() => setExpanded(open ? null : id)}>{open ? '收起' : '明细'}</button></td>
            </tr>
            {open && <tr><td colSpan={12} className="px-3 py-2 bg-slate-800"><PupilEvidence row={row} evidence={evidenceByPupil.get(id) || []}/></td></tr>}
          </React.Fragment>;
        })}
        {!rows.length && <tr><td className="p-4 text-center text-slate-400" colSpan={12}>{loading ? '正在加载' : '暂无符合条件的记录'}</td></tr>}</tbody>
      </table>
    </section>
  </div>;
};
