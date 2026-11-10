import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamEvaluationResult, LearningEvidence } from '../../types';
import { apiSetClassExamPaused, apiTeacher, teacherExportUrl, type TeacherPayload } from '../../api/client';
import { RewardLeaderboard } from './RewardLeaderboard';
import { TeacherOverview, type OverviewPupil } from './TeacherOverview';
import './teacherDashboard.css';

type Pupil = TeacherPayload['students'][number];
type SortField = 'classId' | 'name' | 'lastSync' | 'first' | 'latest' | 'support';
type SortKey = { field: SortField; ascending: boolean };
type ScoreRange = { min: string; max: string };

const classIds = ['501', '502', '503', '504'];
const control = 'g5-teacher-control';
const button = 'g5-teacher-button';
const defaultSorting: SortKey[] = [{ field: 'classId', ascending: true }];
const sortLabels: Record<SortField, string> = {
  classId: '班级', name: '姓名', first: '基础首答', latest: '基础最近', support: '法宝', lastSync: '最近同步',
};
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
const stationFlags = (row: Pupil) => [row.stations.s1_order, secondStationDone(row), row.stations.s3_timing] as const;

function overviewPupil(row: Pupil): OverviewPupil {
  const first = firstResult(row);
  return {
    entered: row.entered,
    stationFlags: stationFlags(row),
    firstScore: first?.baseScore ?? null,
    latestScore: recentResult(row)?.baseScore ?? null,
    firstPassed: !!first?.passed,
    challengePassed: row.challengeFirstComplete && !!(row.challengeFirstResult || row.examResult)?.challengePassed,
  };
}

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
  const passed = stationFlags(row);
  const stations = [
    { name: '行人过街引导台', tasks: ['s1_order', 's2_rewrite'] },
    { name: '信号循环拆解台', tasks: ['s2_vs_branch', 's2_kettle'] },
    { name: '路口信号调度台', tasks: ['s3_timing'] },
  ];
  return <div className="g5-teacher-evidence">
    <div className="g5-teacher-evidence-grid">
      {stations.map(({ name, tasks }, index) => {
        const count = required.filter(item => tasks.includes(item.taskId)).length;
        return <section className="g5-teacher-evidence-card" key={name}>
          <h3>{name}</h3>
          <p><span className="g5-teacher-badge" data-tone={passed[index] ? 'ok' : 'neutral'}>{passed[index] ? '当前通过' : '尚未通过'}</span></p>
          <p>{count ? `${count} 条探究记录` : '尚无证据'}</p>
        </section>;
      })}
    </div>
    <div className="g5-teacher-evidence-grid">
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
          <span className="block g5-teacher-muted">{formatTime(item.receivedAt)}</span>
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
    </div>
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
  const [sorting, setSorting] = useState<SortKey[]>(defaultSorting);
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
      // Fetch the grade once per refresh so class changes and detail filters stay local.
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

  const hasPayload = payload !== null;
  useEffect(() => {
    if (hasPayload && window.location.hash === '#reward-leaderboard-title') {
      document.getElementById('reward-leaderboard-title')?.scrollIntoView({ block: 'start' });
    }
  }, [hasPayload]);

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

  function sortHeader(field: SortField) {
    const index = sorting.findIndex(item => item.field === field);
    const key = sorting[index];
    return <th scope="col" aria-sort={index === 0 ? key.ascending ? 'ascending' : 'descending' : undefined}>
      <button className="g5-teacher-sort" onClick={e => changeSort(field, addSort || e.shiftKey)}>
        {sortLabels[field]}{key && <small>{index + 1}{key.ascending ? '↑' : '↓'}</small>}
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

  const classRoster = payload ? payload.students
    .filter(({ student }) => student.rosterSource === 'roster' &&
      (selectedClass === 'all' || student.classId === selectedClass))
    .map(overviewPupil) : null;
  const hasFilters = !!searchQuery.trim() || [passFilter, targetFilter, evidenceFilter, supportFilter].some(value => value !== 'all') ||
    !!(firstRange.min || firstRange.max || latestRange.min || latestRange.max);
  const overviewRows = rows.map(overviewPupil);
  const isClassSelected = selectedClass !== 'all';
  const isPaused = payload?.examPauses[selectedClass];
  const examStatus = !isClassSelected ? '选择班级后查看考核状态'
    : !payload ? '考核状态尚未获取'
    : isPaused ? '考核已暂停' : '考核开放中';
  const localTeacherUrl = new URL('/teacher', window.location.href);
  localTeacherUrl.hostname = 'localhost';

  const filters = (
    <details className="g5-teacher-card g5-teacher-filters">
      <summary>
        <strong>明细筛选</strong>
        <span>{hasFilters ? '已应用筛选 · ' : ''}{payload ? `${rows.length} 人` : '等待数据'}</span>
      </summary>
      <div className="g5-teacher-filter-body">
        <div className="g5-teacher-filter-grid">
          <label>学生姓名
            <input aria-label="学生姓名" className={control} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索姓名" />
          </label>
          <label>考核状态
            <select aria-label="考核状态" className={control} value={passFilter} onChange={e => setPassFilter(e.target.value)}>
              <option value="all">全部考核状态</option><option value="passed">已达标</option><option value="failed">未达标</option><option value="no_record">尚无考核记录</option>
            </select>
          </label>
          <label>首答目标
            <select aria-label="首答目标" className={control} value={targetFilter} onChange={e => setTargetFilter(e.target.value)}>
              <option value="all">全部首答目标</option><option value="g1:met">G1 达到一半</option><option value="g1:below">G1 待巩固</option><option value="g2:met">G2 达到一半</option><option value="g2:below">G2 待巩固</option>
            </select>
          </label>
          <label>探究证据
            <select aria-label="探究证据" className={control} value={evidenceFilter} onChange={e => setEvidenceFilter(e.target.value)}>
              <option value="all">全部探究证据</option><option value="recorded">已有证据</option><option value="none">尚无证据</option><option value="revision">有修订记录</option><option value="confirmed">有完成确认</option>
            </select>
          </label>
          <label>概念支持
            <select aria-label="概念支持" className={control} value={supportFilter} onChange={e => setSupportFilter(e.target.value)}>
              <option value="all">全部支持状态</option><option value="used">有概念支持记录</option><option value="none">尚无支持记录</option>
            </select>
          </label>
        </div>
        <div className="g5-teacher-range">
          {([{ title: '首答分数', range: firstRange, change: setFirstRange }, { title: '最近分数', range: latestRange, change: setLatestRange }]).map(({ title, range, change }) =>
            <div key={title}><span>{title}</span>
              <input aria-label={`${title}下限`} className={control} type="number" min={0} max={16} value={range.min} onChange={e => change({ ...range, min: e.target.value })} />
              <span>至</span>
              <input aria-label={`${title}上限`} className={control} type="number" min={0} max={16} value={range.max} onChange={e => change({ ...range, max: e.target.value })} />
            </div>)}
        </div>
      </div>
    </details>
  );

  return <div className="g5-teacher">
    <header className="g5-teacher-top">
      <div className="g5-teacher-top-inner">
        <div>
          <p className="g5-teacher-eyebrow">五年级第7课 · 莲花山智慧路口 · 重复操作用循环</p>
          <h1>教师观察大屏</h1>
        </div>
        <div className="g5-teacher-sync">
          <strong><span aria-hidden="true" data-error={!!loadError} />课堂数据</strong>
          <p aria-live="polite">{loadError ? '同步遇到问题' : payload ? `更新于 ${formatTime(payload.updatedAt)}` : '等待同步'}</p>
        </div>
      </div>
    </header>

    <main className="g5-teacher-main">
      {loadError && <p role="status" className="g5-teacher-notice">课堂数据暂时无法更新。{loadError}。可点击「立即刷新」重试。</p>}

      <section aria-label="班级和课堂管理" className="g5-teacher-card g5-teacher-toolbar">
        <label>查看班级
          <select aria-label="班级" className={control} value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setOperationMessage(''); }}>
            <option value="all">全部班级</option>{classIds.map(id => <option key={id} value={id}>{id} 班</option>)}
          </select>
        </label>
        <div className="g5-teacher-actions">
          <span className="g5-teacher-badge" data-tone={!isClassSelected || !payload ? 'neutral' : isPaused ? 'warn' : 'ok'}>{examStatus}</span>
          {isClassSelected && payload?.canManageExam && <button className={button} disabled={saving} onClick={() => void toggleExam()}>
            {saving ? '正在保存…' : isPaused ? '重新开放本班考核' : '暂停本班考核'}
          </button>}
          <button className={button} onClick={() => void refresh()}>立即刷新</button>
          <a className={button} href={teacherExportUrl(isClassSelected ? selectedClass : undefined)} download>导出课堂 CSV</a>
          {onBackToApp && <button className={button} onClick={onBackToApp}>返回学生端</button>}
        </div>
        {isClassSelected && payload && !payload.canManageExam && <p className="g5-teacher-toolbar-note">考核开关可在运行课堂服务的电脑上操作。<a href={localTeacherUrl.href}>本机教师大屏</a></p>}
        {operationMessage && <p className="g5-teacher-toolbar-note" role="status">{operationMessage}</p>}
      </section>

      <TeacherOverview selectedClass={selectedClass} classRoster={classRoster} rows={overviewRows} filters={filters} />

      {(payload || loading) && <RewardLeaderboard entries={payload?.rewardLeaderboard ?? []} selectedClass={selectedClass} pending={!payload} />}

      <section aria-labelledby="g5-student-records" className="g5-teacher-card g5-teacher-students">
        <div className="g5-teacher-section-head">
          <div><p className="g5-teacher-eyebrow">学生明细</p><h2 id="g5-student-records">当前课堂记录</h2></div>
          <p>点击列名切换升降序，展开明细查看各站证据。</p>
        </div>
        <div className="g5-teacher-sort-row">
          <span>排序 {sorting.map(({ field, ascending }) => `${sortLabels[field]}${ascending ? ' ↑' : ' ↓'}`).join(' → ')}</span>
          <label><input type="checkbox" checked={addSort} onChange={e => setAddSort(e.target.checked)} />叠加排序</label>
          <button className="g5-teacher-sort" onClick={() => setSorting(defaultSorting)}>重置排序</button>
        </div>
        <div className="g5-teacher-table-wrap" role="region" aria-label="学生明细表" tabIndex={0}>
          <table className="g5-teacher-table">
            <thead><tr>
              {sortHeader('classId')}{sortHeader('name')}<th scope="col">进入情况</th><th scope="col">三站</th>
              {sortHeader('first')}{sortHeader('latest')}<th scope="col">首答目标</th>
              <th scope="col">达标</th><th scope="col">挑战</th>{sortHeader('support')}{sortHeader('lastSync')}<th scope="col">证据</th>
            </tr></thead>
            <tbody>{rows.map(row => {
              const first = firstResult(row), latest = recentResult(row);
              const id = row.student.studentId, open = expanded === id;
              const [s1, s2, s3] = stationFlags(row);
              const completed = [s1, s2, s3].filter(Boolean).length;
              const challenge = row.challengeFirstComplete ? row.challengeFirstResult : null;
              return <React.Fragment key={id}>
                <tr data-absent={!row.entered}>
                  <td>{row.student.classId}</td><th scope="row">{row.student.name}</th>
                  <td><span className="g5-teacher-badge" data-tone={row.entered ? 'ok' : 'neutral'}>{row.entered ? '已进入' : '未进入'}</span></td>
                  <td title={`第一站${s1 ? '完成' : '尚无完成记录'} · 第二站${s2 ? '完成' : '尚无完成记录'} · 第三站${s3 ? '完成' : '尚无完成记录'}`}><strong className="g5-teacher-count">{completed}</strong> / 3</td>
                  <td>{!first && row.incompleteScores?.base !== undefined ? '旧卷未填完整' : scoreLabel(first)}</td><td>{scoreLabel(latest)}</td><td>{goalLabel(first)}</td>
                  <td>{first ? <span className="g5-teacher-badge" data-tone={first.passed ? 'ok' : 'warn'}>{first.passed ? '达标' : '未达标'}</span> : '—'}</td>
                  <td>{challenge ? `${challenge.challengeScore ?? 0}/${challenge.challengeTotal ?? 6}${challenge.challengePassed ? ' · 加分' : ''}` : '尚无记录'}</td>
                  <td>{row.entered ? `${row.relics.used} / 3` : '—'}</td>
                  <td>{formatTime(row.lastSync)}</td>
                  <td><button className="g5-teacher-evidence-button" aria-expanded={open} aria-label={`${open ? '收起' : '查看'}${row.student.name}明细`} onClick={() => setExpanded(open ? null : id)}>{open ? '收起证据' : '查看证据'}</button></td>
                </tr>
                {open && <tr className="g5-teacher-evidence-row"><td colSpan={12}><PupilEvidence row={row} evidence={evidenceByPupil.get(id) || []}/></td></tr>}
              </React.Fragment>;
            })}
            {!rows.length && <tr><td className="g5-teacher-empty" colSpan={12}>{loading && !payload ? '正在加载' : loadError && !payload ? '课堂数据尚未获取' : '暂无符合条件的记录'}</td></tr>}</tbody>
          </table>
        </div>
        <p className="g5-teacher-footnote">未提交基础考核的学生排在有成绩者之后。必做探究与选做记录在明细中分别显示。</p>
      </section>
    </main>
  </div>;
};
