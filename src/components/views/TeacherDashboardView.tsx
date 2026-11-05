import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ClassId, StudentSessionRecord } from '../../types';
import { CLASS_ROSTERS, TOTAL_STUDENTS_COUNT } from '../../data/roster';
import { apiTeacher, teacherExportUrl, TeacherPayload } from '../../api/client';

/** 固定名单分母下，1 人完成会被 Math.round 成 0%；完成人数>0 时至少显示 <1% 并带人数。 */
function formatStationRate(count: number, total: number): { pctLabel: string; countLabel: string } {
  if (total <= 0) return { pctLabel: '0%', countLabel: '0/0 人' };
  const raw = (count / total) * 100;
  let pctLabel: string;
  if (count <= 0) pctLabel = '0%';
  else if (raw < 1) pctLabel = '<1%';
  else pctLabel = `${Math.round(raw)}%`;
  return { pctLabel, countLabel: `${count}/${total} 人` };
}

interface TeacherDashboardViewProps {
  onBackToApp?: () => void;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  onBackToApp,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [passFilter, setPassFilter] = useState<'all' | 'passed' | 'failed' | 'no_record'>('all');
  const [sortField, setSortField] = useState<string>('classId');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [payload, setPayload] = useState<TeacherPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const data = await apiTeacher(selectedClass === 'all' ? undefined : selectedClass);
      if (requestId !== latestRequest.current) return;
      setPayload(data);
      setLoadError('');
    } catch (err: any) {
      if (requestId !== latestRequest.current) return;
      setLoadError(err?.message || '教师数据加载失败');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const sessions = useMemo(() => {
    const map: Record<string, StudentSessionRecord> = {};
    for (const row of payload?.students || []) {
      if (!row.entered) continue;
      map[row.student.studentId] = {
        student: row.student,
        startedAt: row.lastSync || '',
        lastActiveAt: row.lastSync || '',
        stations: row.stations,
        s3Detail: row.s3Detail,
        relics: row.relics,
        scaffoldHistory: [],
        examResult: row.examResult || undefined,
        rewardUnlocked: row.rewardUnlocked,
      };
    }
    return map;
  }, [payload]);

  const rosterStudents = useMemo(() => {
    if (selectedClass === 'all') {
      return [
        ...CLASS_ROSTERS['501'],
        ...CLASS_ROSTERS['502'],
        ...CLASS_ROSTERS['503'],
        ...CLASS_ROSTERS['504'],
      ];
    }
    return CLASS_ROSTERS[selectedClass as ClassId] || [];
  }, [selectedClass]);

  const mergedStudentRows = useMemo(() => {
    // Prefer server rows (includes manual); fall back to full roster denominator list
    const byId = new Map(rosterStudents.map(s => [s.studentId, s]));
    for (const row of payload?.students || []) {
      byId.set(row.student.studentId, row.student);
    }
    return Array.from(byId.values()).map(student => {
      const session = sessions[student.studentId];
      return {
        student,
        session,
        isLoggedIn: !!session,
        s1Ok: session?.stations.s1_order ?? false,
        s2Ok: (session?.stations.s2_rewrite && session?.stations.s2_vs_branch && session?.stations.s2_kettle) ?? false,
        s3Ok: session?.stations.s3_timing ?? false,
        examScore: session?.examResult?.baseScore,
        passed: session?.examResult?.passed ?? false,
        g1Score: session?.examResult?.g1Score,
        g2Score: session?.examResult?.g2Score,
        challengeScore: session?.examResult?.challengeScore,
        challengeBonus: session?.examResult?.challengePassed ?? false,
        relicUsed: session?.relics.used ?? 0,
        relicRemaining: session?.relics.remaining ?? 3,
      };
    });
  }, [sessions, rosterStudents, payload]);

  const totalRosterCount = payload?.denominator
    ?? (selectedClass === 'all'
      ? TOTAL_STUDENTS_COUNT
      : CLASS_ROSTERS[selectedClass as ClassId]?.length || TOTAL_STUDENTS_COUNT);

  const filteredRows = useMemo(() => {
    return mergedStudentRows.filter(row => {
      if (selectedClass !== 'all' && row.student.classId !== selectedClass) return false;
      if (searchQuery.trim() && !row.student.name.includes(searchQuery.trim())) return false;
      if (passFilter === 'passed' && !row.passed) return false;
      if (passFilter === 'failed' && (row.passed || row.examScore === undefined)) return false;
      if (passFilter === 'no_record' && row.examScore !== undefined) return false;
      return true;
    });
  }, [mergedStudentRows, selectedClass, searchQuery, passFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];
      if (sortField === 'classId') {
        valA = a.student.classId;
        valB = b.student.classId;
      } else if (sortField === 'name') {
        valA = a.student.name;
        valB = b.student.name;
      }
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortAsc]);

  const stats = useMemo(() => {
    const relevant = selectedClass === 'all'
      ? mergedStudentRows
      : mergedStudentRows.filter(r => r.student.classId === selectedClass);
    const rosterRows = relevant.filter(r => r.student.rosterSource === 'roster');
    // Prefer row-derived counts so KPI 与名单 ✓ 同源；summary 作交叉校验兜底
    const s1FromRows = rosterRows.filter(r => r.s1Ok).length;
    const s2FromRows = rosterRows.filter(r => r.s2Ok).length;
    const s3FromRows = rosterRows.filter(r => r.s3Ok).length;
    const examFromRows = rosterRows.filter(r => r.passed).length;
    const loggedCount = payload?.summary.entered ?? relevant.filter(r => r.isLoggedIn).length;
    const s1Count = Math.max(payload?.summary.s1 ?? 0, s1FromRows);
    const s2Count = Math.max(payload?.summary.s2 ?? 0, s2FromRows);
    const s3Count = Math.max(payload?.summary.s3 ?? 0, s3FromRows);
    const examPassedCount = Math.max(payload?.summary.examPassed ?? 0, examFromRows);
    const challengeBonusCount = payload?.summary.challengeBonus ?? relevant.filter(r => r.challengeBonus).length;
    const totalRelicsUsed = payload?.summary.relicUsed ?? relevant.reduce((sum, r) => sum + r.relicUsed, 0);
    const s1 = formatStationRate(s1Count, totalRosterCount);
    const s2 = formatStationRate(s2Count, totalRosterCount);
    const s3 = formatStationRate(s3Count, totalRosterCount);
    const exam = formatStationRate(examPassedCount, totalRosterCount);
    return {
      loggedCount,
      totalCount: totalRosterCount,
      s1Count,
      s2Count,
      s3Count,
      examPassedCount,
      s1Pct: s1.pctLabel,
      s2Pct: s2.pctLabel,
      s3Pct: s3.pctLabel,
      examPct: exam.pctLabel,
      s1Detail: s1.countLabel,
      s2Detail: s2.countLabel,
      s3Detail: s3.countLabel,
      examDetail: exam.countLabel,
      challengeBonusCount,
      avgRelicUse: loggedCount > 0 ? (totalRelicsUsed / loggedCount).toFixed(1) : '0.0',
    };
  }, [mergedStudentRows, selectedClass, totalRosterCount, payload]);

  const handleExportCSV = () => {
    // Prefer server CSV (authoritative)
    const a = document.createElement('a');
    a.href = teacherExportUrl(selectedClass === 'all' ? undefined : selectedClass);
    a.download = `五年级第7课_课堂数据_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-6 select-none font-sans">
      {(loadError || loading) && (
        <div className={`mb-3 text-xs px-3 py-2 rounded-lg ${loadError ? 'bg-rose-600/80' : 'bg-slate-800'} border border-slate-700`}>
          {loadError ? `服务端：${loadError}` : '正在同步教师大屏…'}
          {payload?.updatedAt ? ` · 更新于 ${payload.updatedAt}` : ''}
        </div>
      )}
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-xl font-bold text-white">
              五年级《身边的算法》第7课《重复操作用循环》· 教师大屏
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              免密实时监控
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            莲花山智慧路口三站探究进度 · 分层考核达标率 · 法宝使用与错因诊断
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition flex items-center gap-1.5"
          >
            <span>📥 导出课堂 CSV 报表</span>
          </button>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              返回学生端
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards (Fixed Denominator per spec) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total login */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">已登录人数</div>
          <div className="text-2xl font-black text-white mt-1">
            {stats.loggedCount}
            <span className="text-xs text-slate-500 font-normal"> / {stats.totalCount} (固定分母)</span>
          </div>
        </div>

        {/* S1 Rate */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">S1 过街引导完成率</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.s1Pct}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.s1Detail}</div>
        </div>

        {/* S2 Rate */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">S2 循环拆解完成率</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.s2Pct}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.s2Detail}</div>
        </div>

        {/* S3 Rate */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">S3 时长调度完成率</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.s3Pct}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.s3Detail}</div>
        </div>

        {/* Exam pass rate */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">基础考核达标率</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {stats.examPct}
            <span className="text-[10px] text-slate-400 font-normal ml-1">(≥13题)</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.examDetail}</div>
        </div>

        {/* Relic average use */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400">法宝人均使用</div>
          <div className="text-2xl font-black text-cyan-400 mt-1">
            {stats.avgRelicUse}
            <span className="text-xs text-slate-500 font-normal"> / 3次</span>
          </div>
        </div>
      </div>

      {/* Filter and Query Bar */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow">
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">班级：</span>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="all">全年级 (501–504 · 共212人)</option>
              <option value="501">501 班 (53人)</option>
              <option value="502">502 班 (53人)</option>
              <option value="503">503 班 (52人)</option>
              <option value="504">504 班 (54人)</option>
            </select>
          </div>

          {/* Pass status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">考核状态：</span>
            <select
              value={passFilter}
              onChange={e => setPassFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="all">全部状态</option>
              <option value="passed">已达标 (≥13分)</option>
              <option value="failed">未达标</option>
              <option value="no_record">尚无考核证据</option>
            </select>
          </div>

          {/* Search name */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索姓名..."
            className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500 w-36"
          />
        </div>

        <div className="text-xs text-slate-400">
          显示 <strong className="text-amber-400">{sortedRows.length}</strong> / {totalRosterCount} 位学生
        </div>
      </div>

      {/* Main Student Data Table */}
      <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] border-b border-slate-700 select-none">
              <tr>
                <th onClick={() => handleSort('classId')} className="py-3 px-3 cursor-pointer hover:text-white">
                  班级 {sortField === 'classId' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('name')} className="py-3 px-3 cursor-pointer hover:text-white">
                  姓名 {sortField === 'name' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3">登录态</th>
                <th onClick={() => handleSort('s1Ok')} className="py-3 px-3 cursor-pointer hover:text-white">
                  S1过街 {sortField === 's1Ok' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('s2Ok')} className="py-3 px-3 cursor-pointer hover:text-white">
                  S2拆解 {sortField === 's2Ok' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('s3Ok')} className="py-3 px-3 cursor-pointer hover:text-white">
                  S3调度 {sortField === 's3Ok' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('examScore')} className="py-3 px-3 cursor-pointer hover:text-white">
                  基础考核 {sortField === 'examScore' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3">G1/G2目标</th>
                <th onClick={() => handleSort('passed')} className="py-3 px-3 cursor-pointer hover:text-white">
                  达标状态 {sortField === 'passed' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3">挑战加分</th>
                <th onClick={() => handleSort('relicUsed')} className="py-3 px-3 cursor-pointer hover:text-white">
                  法宝使用 {sortField === 'relicUsed' && (sortAsc ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedRows.map(row => (
                <tr key={row.student.studentId} className="hover:bg-slate-800/50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-300">
                    {row.student.classId} 班
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {row.student.name}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.isLoggedIn ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/40">
                        在线
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">未登录</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.s1Ok ? (
                      <span className="text-emerald-400 font-bold">✓ 完成</span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.s2Ok ? (
                      <span className="text-emerald-400 font-bold">✓ 完成</span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.s3Ok ? (
                      <span className="text-emerald-400 font-bold">✓ 完成</span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.examScore !== undefined ? (
                      <span className="font-mono font-bold text-amber-300">
                        {row.examScore} / 16
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">
                    {row.g1Score !== undefined ? (
                      <span>G1:{row.g1Score}/5 · G2:{row.g2Score}/3</span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.passed ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50">
                        达标 (≥13)
                      </span>
                    ) : row.examScore !== undefined ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40">
                        未达标
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">
                    {row.challengeScore !== undefined ? (
                      <span className={row.challengeBonus ? 'text-purple-300 font-bold' : 'text-slate-400'}>
                        {row.challengeScore}/6 {row.challengeBonus && '★加分'}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">尚无证据</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] font-mono text-slate-300">
                    {row.relicUsed} / 3 次
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
