import { useState, type ReactNode } from 'react';
import './teacherOverview.css';

export type OverviewPupil = {
  entered: boolean;
  stationFlags: readonly [boolean, boolean, boolean];
  firstScore: number | null;
  latestScore: number | null;
  firstPassed: boolean;
  challengePassed: boolean;
};

type TeacherOverviewProps = {
  selectedClass: string;
  classRoster: readonly OverviewPupil[] | null;
  rows: readonly OverviewPupil[];
  filters?: ReactNode;
};

const stationNames = ['一站 · 过街顺序', '二站 · 循环拆解', '三站 · 时长调度'];
const scoreBands = [
  { min: 13, max: 16, label: '13–16 分', tone: 'high' },
  { min: 10, max: 12, label: '10–12 分', tone: 'mid' },
  { min: 6, max: 9, label: '6–9 分', tone: 'low' },
  { min: 0, max: 5, label: '0–5 分', tone: 'low' },
];

function percentage(count: number, total: number) {
  return total > 0 ? Math.round(count / total * 100) : 0;
}

function ChartBar({ label, count, total, ready, tone }: {
  label: string;
  count: number;
  total: number;
  ready: boolean;
  tone?: string;
}) {
  return <li className="g5-overview-bar">
    <span>{label}</span>
    <span className="g5-overview-track" aria-hidden="true">
      <i data-tone={tone} style={{ width: `${percentage(count, total)}%` }} />
    </span>
    <strong>{ready ? count : '—'}{ready && <small> / {total}</small>}</strong>
  </li>;
}

export function TeacherOverview({ selectedClass, classRoster, rows, filters }: TeacherOverviewProps) {
  const [scoreKind, setScoreKind] = useState<'first' | 'latest'>('latest');
  const scope = selectedClass === 'all' ? '全年级' : `${selectedClass} 班`;
  const roster = classRoster ?? [];
  const ready = classRoster !== null;
  const kpis = [
    { label: '名单人数', value: roster.length, detail: '固定分母' },
    { label: '已进入', value: roster.filter(row => row.entered).length },
    { label: '三站全通', value: roster.filter(row => row.stationFlags.every(Boolean)).length },
    { label: '已提交基础', value: roster.filter(row => row.firstScore !== null).length },
    { label: '基础首答达标', value: roster.filter(row => row.firstPassed).length },
    { label: '挑战加分', value: roster.filter(row => row.challengePassed).length },
  ];
  const entered = rows.filter(row => row.entered).length;
  const scores = rows.flatMap(row => {
    const score = scoreKind === 'first' ? row.firstScore : row.latestScore;
    return score === null ? [] : [score];
  });
  const enteredPercentage = percentage(entered, rows.length);

  return <section className="g5-teacher-overview" aria-labelledby="g5-overview-heading">
    <header className="g5-overview-heading">
      <h2 id="g5-overview-heading">{scope}课堂概览</h2>
      <p>分母固定为所选范围的在册人数。<strong>{ready ? `${roster.length} 人` : '—'}</strong></p>
    </header>
    <dl className="g5-overview-kpis" aria-label={`${scope}固定概览`}>
      {kpis.map(({ label, value, detail }, index) => <div key={label} className="g5-overview-kpi" data-roster={index === 0 || undefined}>
        <dt>{label}</dt>
        <dd>
          <strong>{ready ? value : '—'}</strong>
          <small>{detail ?? (ready && roster.length > 0 ? `占在册 ${percentage(value, roster.length)}%` : '—')}</small>
        </dd>
      </div>)}
    </dl>

    {filters && <div className="g5-overview-filters">{filters}</div>}
    <div className="g5-overview-heading g5-overview-chart-heading">
      <h3 id="g5-filter-chart-heading">筛选结果图表</h3>
      <p>{ready ? `符合筛选 ${rows.length} 人，含匹配的名单外学生。` : '等待课堂数据同步。'}</p>
    </div>
    <div className="g5-overview-charts" role="group" aria-labelledby="g5-filter-chart-heading">
      <article className="g5-overview-card">
        <h4>到课与参与</h4>
        <p>分母为符合筛选的学生。</p>
        <div className="g5-overview-participation">
          <svg viewBox="0 0 120 120" className="g5-overview-donut" aria-hidden="true">
            <circle cx="60" cy="60" r="46" fill="none" strokeWidth="16" className="g5-overview-donut-track" />
            {entered > 0 && <circle cx="60" cy="60" r="46" fill="none" strokeWidth="16" pathLength="100"
              transform="rotate(-90 60 60)" strokeDasharray={`${entered / rows.length * 100} 100`} className="g5-overview-donut-fill" />}
            <text x="60" y="56" textAnchor="middle" className="g5-overview-donut-number">{ready && rows.length > 0 ? `${enteredPercentage}%` : '—'}</text>
            <text x="60" y="75" textAnchor="middle" className="g5-overview-donut-caption">已进入</text>
          </svg>
          <ul className="g5-overview-legend">
            <li><i data-entered aria-hidden="true" />已进入 <strong>{ready ? entered : '—'}</strong></li>
            <li><i aria-hidden="true" />尚未进入 <strong>{ready ? rows.length - entered : '—'}</strong></li>
          </ul>
        </div>
      </article>
      <article className="g5-overview-card">
        <h4>三站当前通过</h4>
        <p>分母为符合筛选的学生，按各站当前状态统计。</p>
        <ul className="g5-overview-bars">
          {stationNames.map((label, index) => <ChartBar key={label} label={label} count={rows.filter(row => row.stationFlags[index]).length} total={rows.length} ready={ready} />)}
        </ul>
      </article>
      <article className="g5-overview-card">
        <div className="g5-overview-score-title">
          <h4>基础成绩分布</h4>
          <div role="group" aria-label="基础成绩口径" className="g5-overview-segments">
            <button type="button" aria-pressed={scoreKind === 'latest'} onClick={() => setScoreKind('latest')}>最近</button>
            <button type="button" aria-pressed={scoreKind === 'first'} onClick={() => setScoreKind('first')}>首次</button>
          </div>
        </div>
        <p>区间分母为已提交人数，未提交单列。</p>
        <ul className="g5-overview-bars">
          {scoreBands.map(({ min, max, label, tone }) => <ChartBar key={label} label={label}
            count={scores.filter(score => score >= min && score <= max).length} total={scores.length} ready={ready} tone={tone} />)}
        </ul>
        <div className="g5-overview-unsubmitted">未提交 <strong>{ready ? `${rows.length - scores.length} 人` : '—'}</strong></div>
      </article>
    </div>
  </section>;
}
