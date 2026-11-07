import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, HelpCircle, Pause, Play, Repeat2, RotateCcw, SkipForward, Sparkles, Undo2, X } from 'lucide-react';
import FlowDiagram, { type DiagramEdge, type DiagramNode } from './FlowDiagram';
import LessonScene from './LessonScene';
import { simulateCrossing, simulateKettle, simulateTraffic, isTrafficReasonCorrect, normalizeCrossingPlan, type CrossingCaseId, type CrossingPlan, type CrossingRun, type TraceStep, type TrafficUnits } from '../../lesson/model';
import { makeEventId } from '../../utils/eventId';
import MazeTransfer from '../../lesson/MazeTransfer';
import { restoreStationState, scaffoldFor, trafficUnits } from './stationRestore';
import TimingComparison, { type TimingComparisonResult } from './TimingComparison';
import './lesson.css';

export type StationKind = 's1' | 's2b' | 's2c' | 's3';
type Completion = { correct: true; evidenceCode: string; payload: Record<string, unknown>; s3Detail?: any };
type Props = { station: StationKind; studentId?: string; initialS3?: any; initialEvidence?: any[]; freshStart?: boolean; resetId?: string; onComplete: (result: Completion) => void; onCancel: () => void; onRestart?: () => void; onEvidence: (event: any) => void; relicRemaining?: number; onUseRelic?: () => void };
const taskIds = { s1: 's2_rewrite', s2b: 's2_vs_branch', s2c: 's2_kettle', s3: 's3_timing' };
const conditionCards = [ ['cond_green_off', '绿灯未亮起？'], ['cond_bridge', '有可用天桥？'], ['cond_count', '已经等了三次？'], ['act_as_diamond', '原地观察红绿灯'], ['cond_arrive', '到达对面了吗？'] ] as const;
const names = { s1: ['行人引导台', '怎样把“一直等”说清楚？'], s2b: ['信号拆解台', '哪张图会让某一步再做一次？'], s2c: ['休息点的热水壶', '它什么时候加热，什么时候停？'], s3: ['路口调度台', '怎样缓解车多方向的排队？'] };
const learnCards = {
  s1: { image: 's1', page: 41, title: '把步骤说清楚', lines: ['菱形里放能回答是或否的问题。', '沿箭头看看哪些步骤会再做。'] },
  s2b: { image: 's2', page: 42, title: '沿着箭头读流程', lines: ['判断框决定接下来做什么。', '比较箭头，看它选路还是再做。'] },
  s2c: { image: 's2', page: 42, title: '看看热水壶的流程', lines: ['先沿箭头找到读取和判断。', '留意加热前后，哪些步骤会重复。'] },
  s3: { image: 's3', page: 43, title: '让比较更公平', lines: ['信号时长要结合人流和车流。', '比较前后结果时，保持其他条件相同。'] },
};

function readDraft(key: string): any {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
}
function hasLearned(key: string): boolean { try { return localStorage.getItem(key) === '1'; } catch { return false; } }

function usePlayback() {
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const done = useRef<(() => void) | null>(null);
  const finished = useRef(true);
  useEffect(() => {
    if (!trace.length || finished.current || index < trace.length - 1) return;
    finished.current = true;
    setRunning(false);
    done.current?.();
  }, [index, trace]);
  useEffect(() => {
    if (!running || index >= trace.length - 1) return;
    const timer = window.setTimeout(() => setIndex(i => i + 1), 700);
    return () => window.clearTimeout(timer);
  }, [running, index, trace]);
  const play = (steps: TraceStep[], onDone: () => void, auto = true) => { done.current = onDone; finished.current = false; setTrace(steps); setIndex(0); setRunning(auto); };
  const stop = () => { finished.current = true; done.current = null; setRunning(false); setTrace([]); setIndex(0); };
  return { trace, index, running, step: trace[index], play, stop, toggle: () => setRunning(v => !v), advance: () => { setRunning(false); setIndex(i => Math.min(i + 1, trace.length - 1)); }, hasNext: trace.length > 0 && index < trace.length - 1 };
}

function crossingNodes(condition = '选择判断条件', branches = true): DiagramNode[] {
  return [
    { id: 'start', label: '到达十字路口', kind: 'start', x: 90, y: 0 },
    { id: 'observe', label: '观察红绿灯', kind: 'process', x: 90, y: 87 },
    { id: 'decide', label: condition, kind: 'decision', x: 70, y: 170, empty: condition === '选择判断条件', branches },
    { id: 'cross', label: '过马路', kind: 'process', x: 90, y: 330 },
    { id: 'end', label: '到达马路对面', kind: 'start', x: 90, y: 417 },
  ];
}
const crossingFixed: DiagramEdge[] = [{ id: 'arrive', from: 'start', to: 'observe' }, { id: 'cross_end', from: 'cross', to: 'end' }];
const loopEdges: DiagramEdge[] = [...crossingFixed, { id: 'observe_decide', from: 'observe', to: 'decide' }, { id: 'back', from: 'decide', to: 'observe', branch: 'yes', back: true, label: '是' }, { id: 'exit', from: 'decide', to: 'cross', branch: 'no', label: '否' }];
const kettleNodes: DiagramNode[] = [
  { id: 'start', label: '开始烧水', kind: 'start', x: 180, y: 0 },
  { id: 'check', label: '读取水温', kind: 'process', x: 180, y: 84 },
  { id: 'decide', label: '水温低于100℃？', kind: 'decision', x: 160, y: 170 },
  { id: 'heat', label: '继续加热', kind: 'process', x: -100, y: 193 },
  { id: 'stop', label: '停止加热', kind: 'process', x: 180, y: 330 },
  { id: 'end', label: '结束', kind: 'start', x: 180, y: 417 },
];
const kettleEdges: DiagramEdge[] = [ { id: 'begin_read', from: 'start', to: 'check' }, { id: 'read_question', from: 'check', to: 'decide' }, { id: 'heat_yes', from: 'decide', to: 'heat', branch: 'yes', label: '是' }, { id: 'heat_read', from: 'heat', to: 'check', back: true }, { id: 'stop_no', from: 'decide', to: 'stop', branch: 'no', label: '否' }, { id: 'stop_end', from: 'stop', to: 'end' } ];
const branchNodes: DiagramNode[] = [ { id: 'start', label: '到达路口', kind: 'start', x: 100, y: 0 }, { id: 'decide', label: '有可用天桥？', kind: 'decision', x: 80, y: 100 }, { id: 'bridge', label: '走天桥', kind: 'process', x: -25, y: 300 }, { id: 'wait', label: '去人行横道', kind: 'process', x: 235, y: 300 }, { id: 'end', label: '继续前行', kind: 'start', x: 100, y: 420 } ];
const branchEdges: DiagramEdge[] = [ { id: 'branch_begin', from: 'start', to: 'decide' }, { id: 'branch_yes', from: 'decide', to: 'bridge', branch: 'yes', label: '是' }, { id: 'branch_no', from: 'decide', to: 'wait', branch: 'no', label: '否' }, { id: 'bridge_end', from: 'bridge', to: 'end' }, { id: 'wait_end', from: 'wait', to: 'end' } ];

export default function StationPanel(props: Props) {
  const draftKey = `g5l7.lessonDraft.v1.${props.studentId || 'local'}.${props.station}`;
  const learnKey = `g5l7.learnSeen.v1.${props.studentId || 'local'}.${props.station}`;
  const [restored] = useState(() => restoreStationState({ taskId: taskIds[props.station], draft: readDraft(draftKey), initialS3: props.initialS3, evidence: props.initialEvidence, freshStart: props.freshStart, resetId: props.resetId || (props.freshStart ? makeEventId('reset') : undefined) }));
  const playback = usePlayback();
  const panelRef = useRef<HTMLElement | null>(null);
  const [supportUsed, setSupportUsed] = useState(restored.supportUsed);
  const supportUsedRef = useRef(restored.supportUsed);
  const [errorCount, setErrorCount] = useState(restored.errorCount);
  const errorCountRef = useRef(restored.errorCount);
  const [scaffoldLevel, setScaffoldLevel] = useState(0);
  const [help, setHelp] = useState('');
  const [learnOpen, setLearnOpen] = useState(() => !hasLearned(learnKey));
  const [guideActive, setGuideActive] = useState(false);
  const [timingOpen, setTimingOpen] = useState(false);
  const [timingComparisons, setTimingComparisons] = useState<TimingComparisonResult[]>(() => Array.isArray(restored.draft.timingComparisons) ? restored.draft.timingComparisons : []);
  const [mazeOpen, setMazeOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [passed, setPassed] = useState(false);
  const [plan, setPlan] = useState<CrossingPlan>(() => normalizeCrossingPlan(restored.draft.plan));
  const [branch, setBranch] = useState<'yes' | 'no' | ''>('');
  const [history, setHistory] = useState<CrossingPlan[]>([]);
  const [crossingCase, setCrossingCase] = useState<CrossingCaseId>('green_at_start');
  const [crossingResults, setCrossingResults] = useState<Partial<Record<CrossingCaseId, CrossingRun>>>({});
  const attemptedPlan = useRef('');
  const scaffoldedPlan = useRef('');
  const [diagramChoice, setDiagramChoice] = useState<'loop' | 'branch' | ''>(() => ['loop', 'branch'].includes(restored.draft.diagramChoice) ? restored.draft.diagramChoice : '');
  const [edgeChoice, setEdgeChoice] = useState<string>(restored.draft.edgeChoice || '');
  const [comparisonHistory, setComparisonHistory] = useState<Array<{ diagramChoice: typeof diagramChoice; edgeChoice: string }>>([]);
  const [kettleStage, setKettleStage] = useState(0);
  const [kettleChoices, setKettleChoices] = useState<string[]>(() => Array.isArray(restored.draft.kettleChoices) && restored.draft.kettleChoices.length === 3 ? restored.draft.kettleChoices : ['', '', '']);
  const [kettleHistory, setKettleHistory] = useState<Array<{ choices: string[]; stage: number }>>([]);
  const [temperature, setTemperature] = useState<80 | 100>(80);
  const [kettleRuns, setKettleRuns] = useState<number[]>([]);
  const [baseline, setBaseline] = useState(restored.baseline);
  const [units, setUnits] = useState<TrafficUnits | null>(restored.units);
  const [reason, setReason] = useState<string>(restored.reason);
  const [trafficEdits, setTrafficEdits] = useState<Array<{ units: TrafficUnits | null; reason: string }>>([]);
  const [trafficResult, setTrafficResult] = useState<ReturnType<typeof simulateTraffic> | null>(() => trafficUnits(restored.lastRun?.greenUnits) ? simulateTraffic(restored.lastRun.greenUnits) : null);
  const [trafficHistory, setTrafficHistory] = useState<any[]>(restored.history);
  const completed = useRef(false);
  const taskId = taskIds[props.station];
  const emit = (eventType: string, payload: Record<string, unknown>, correct?: boolean) => props.onEvidence({ taskId, eventType, eventId: makeEventId('lesson'), ...(correct === undefined ? {} : { correct }), payload: { ...payload, supportUsed: supportUsedRef.current || payload.supportUsed === true } });
  const invalidate = () => { playback.stop(); setPassed(false); setFeedback(''); emit('current_invalidated', { reason: 'edit' }); };
  const close = () => { playback.stop(); props.onCancel(); };
  const pauseForHelp = () => { if (playback.running) playback.toggle(); };
  const dismissLearn = () => { try { localStorage.setItem(learnKey, '1'); } catch { /* A missing flag only reopens this closable card. */ } setLearnOpen(false); };
  const markSupport = (kind: string, extra: Record<string, unknown> = {}) => { supportUsedRef.current = true; setSupportUsed(true); emit('scenario_run', { kind, supportUsed: true, ...extra }); };
  const registerFailure = (observation = '') => {
    const count = errorCountRef.current + 1;
    errorCountRef.current = count;
    setErrorCount(count);
    const scaffold = scaffoldFor(props.station, count);
    setScaffoldLevel(scaffold.level);
    setFeedback(observation ? `${observation} ${scaffold.text}` : scaffold.text);
    markSupport('error_scaffold', { level: scaffold.level, errorCount: count });
  };
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ resetId: restored.resetId, plan, diagramChoice, edgeChoice, kettleChoices, units, reason, supportUsed, errorCount, timingComparisons })); } catch { /* Server evidence remains the source of completed observations. */ } }, [draftKey, restored.resetId, plan, diagramChoice, edgeChoice, kettleChoices, units, reason, supportUsed, errorCount, timingComparisons]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (help || learnOpen)) { if (help) setHelp(''); else dismissLearn(); event.preventDefault(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [help, learnOpen, learnKey]);
  const complete = (evidenceCode: string, payload: Record<string, unknown>, s3Detail?: any) => {
    if (completed.current) return;
    completed.current = true;
    playback.stop();
    props.onComplete({ correct: true, evidenceCode, payload: { ...payload, supportUsed: supportUsedRef.current }, ...(s3Detail ? { s3Detail } : {}) });
  };

  const updatePlan = (next: CrossingPlan) => { invalidate(); attemptedPlan.current = ''; scaffoldedPlan.current = ''; setHistory(h => [...h, { ...plan }]); setPlan(next); setCrossingResults({}); setBranch(''); };
  const undo = () => {
    if (playback.running) return;
    if (props.station === 's1' && history.length) { invalidate(); setPlan(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setCrossingResults({}); setBranch(''); }
    else if (props.station === 's2b' && comparisonHistory.length) { invalidate(); const previous = comparisonHistory[comparisonHistory.length - 1]; setDiagramChoice(previous.diagramChoice); setEdgeChoice(previous.edgeChoice); setComparisonHistory(old => old.slice(0, -1)); }
    else if (props.station === 's2c' && kettleHistory.length) { invalidate(); const previous = kettleHistory[kettleHistory.length - 1]; setKettleChoices(previous.choices); setKettleStage(previous.stage); setKettleHistory(old => old.slice(0, -1)); }
    else if (props.station === 's3' && trafficEdits.length) { invalidate(); const previous = trafficEdits[trafficEdits.length - 1]; setUnits(previous.units); setReason(previous.reason); setTrafficEdits(old => old.slice(0, -1)); }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (help || learnOpen || mazeOpen || timingOpen) return; if (event.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); undo(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const runCrossing = (auto = true) => {
    if (!plan.condition || !plan.yes || !plan.no) return;
    // A new explicit retry starts a new attempt; the two different cases in one round share it.
    if (crossingResults[crossingCase]) { attemptedPlan.current = ''; scaffoldedPlan.current = ''; }
    setFeedback('');
    const result = simulateCrossing(plan, crossingCase);
    playback.play(result.trace, () => {
      const next = { ...crossingResults, [crossingCase]: result };
      setCrossingResults(next);
      emit('case_run', { conditionCardId: plan.condition, wires: { yes: plan.yes, no: plan.no }, case: result }, result.correct);
      const key = JSON.stringify(plan);
      if (!result.correct && attemptedPlan.current !== key) {
        emit('attempt', { plan, caseResults: Object.values(next) }, false);
        attemptedPlan.current = key;
      }
      if (next.green_at_start && next.red_then_green) {
        const ok = next.green_at_start.correct && next.red_then_green.correct;
        setPassed(ok);
        setFeedback(ok ? '两种情况都验证了。看看哪里在重复、哪里离开。' : '有一种情况未能按任务通过。修改条件或箭头再试。');
      } else setFeedback('这个情形已运行。换另一种灯色情形试试。');
      const bothTested = !!next.green_at_start && !!next.red_then_green;
      const observableFailure = result.outcome !== 'crossed_green';
      if (!result.correct && scaffoldedPlan.current !== key && (observableFailure || bothTested)) {
        scaffoldedPlan.current = key;
        registerFailure(observableFailure ? result.trace[result.trace.length - 1]?.label : '行人通过了，但有不需要重复的步骤也被重复了。');
      }
    }, auto);
  };
  const checkComparison = () => {
    const ok = diagramChoice === 'loop' && edgeChoice === 'back';
    if (!ok) { emit('attempt', { selectedSide: diagramChoice, edgeId: edgeChoice }, false); registerFailure(); return; }
    setPassed(true); setFeedback('你找到了让步骤再做一次的箭头。');
  };
  const runKettle = (auto = true) => {
    setFeedback('');
    const trace = simulateKettle(temperature);
    playback.play(trace, () => { setKettleRuns(old => [...new Set([...old, temperature])]); emit('case_run', { initialTemperature: temperature, trace }); setFeedback(temperature === 100 ? '已经100℃时，先读取判断，没有加热。' : '水温不足时才加热，然后再次读取判断。'); }, auto);
  };
  const checkKettle = () => {
    const comparison = timingComparisons[timingComparisons.length - 1];
    const ok = ['read', 'heat'].includes(kettleChoices[0]) && kettleChoices[1] === 'at100' && kettleChoices[2] === 'ask' && comparison?.prediction === 'ask';
    if (!ok) { emit('attempt', { repeatStepId: kettleChoices[0], stopChoice: kettleChoices[1], timingChoice: kettleChoices[2], testedTemperatures: kettleRuns, comparison, comparisonHistory: timingComparisons }, false); registerFailure(); return; }
    setPassed(true); setFeedback('你能认出反复步骤、停止条件和判断的先后了。');
  };
  const runTraffic = (auto = true) => {
    const green = baseline ? units : 3;
    if (!green || (baseline && !reason)) return;
    const result = simulateTraffic(green);
    const wasBaseline = !baseline;
    setFeedback('');
    playback.play(result.trace, () => {
      setTrafficResult(result);
      const ok = !wasBaseline && result.remainingCars < 9 && isTrafficReasonCorrect(reason);
      const entry = { ...result, kind: wasBaseline ? 'baseline' : 'attempt', strategy: `st_${green}`, reason, correct: ok };
      setTrafficHistory(old => [...old, entry]);
      emit('simulation_run', entry, ok);
      if (wasBaseline) { setBaseline(true); setFeedback('原方案还等9辆。现在选时长和理由，再比较。'); }
      else { setPassed(ok); if (ok) setFeedback('当前排队减少了，也要顾及其他方向的等待。'); else registerFailure(); }
    }, auto);
  };

  const ready = props.station === 's1' ? !!(plan.condition && plan.yes && plan.no) : props.station === 's2c' ? true : props.station === 's3' ? !baseline || !!(units && reason) : false;
  const startPlayback = (auto = true) => props.station === 's1' ? runCrossing(auto) : props.station === 's2c' ? runKettle(auto) : props.station === 's3' ? runTraffic(auto) : undefined;
  const hint = props.station === 's1' ? !plan.condition ? '先从下面选择判断条件。' : !plan.yes || !plan.no ? branch ? `现在点一个流程框，连接“${branch === 'yes' ? '是' : '否'}”。` : '点“是”或“否”，再点它要去的流程框。' : '运行两个灯色情形，检验你的流程。' : props.station === 's2b' ? !diagramChoice ? '先选择一张图。两张图都可以点击。' : '再点一条箭头，说明你的判断。' : props.station === 's2c' ? '先运行两种水温，再认读流程。' : !baseline ? '先运行原方案，看一轮结果。' : !units ? '选择车多方向的绿灯时长。' : !reason ? '选择你调整时长的理由。' : '在相同车流条件下重新运行。';
  const mainText = props.station === 's1' ? '完成引导台' : props.station === 's2b' ? '继续看热水壶' : props.station === 's2c' ? '完成拆解台' : '完成调度台';
  const mainAction = () => {
    if (!passed) return;
    if (props.station === 's1') complete('E1', { conditionCardId: plan.condition, repeatCardId: 'observe', backEdgeTo: plan.yes, noEdgeTo: plan.no, caseResults: Object.values(crossingResults), capture: 'in_world_action' });
    if (props.station === 's2b') complete('E2', { selectedSide: diagramChoice, highlightedBackEdge: edgeChoice === 'back', capture: 'in_world_action' });
    if (props.station === 's2c') complete('E3', { repeatStepId: kettleChoices[0], conditionId: 'water_below_100', stopChoice: kettleChoices[1], timingChoice: kettleChoices[2], testedTemperatures: kettleRuns, comparison: timingComparisons[timingComparisons.length - 1], comparisonHistory: timingComparisons, capture: 'in_world_action' });
    if (props.station === 's3') {
      const detail = { faultObserved: true, scenario: 'car_heavy', strategy: units === 6 ? 'st_car_long' : 'st_longest', reason, ruleChanged: true, revalidateOk: true, runHistory: trafficHistory };
      complete('E4', { faultObserved: true, strategyId: detail.strategy, reasonId: reason, revalidateOk: true, runHistory: trafficHistory, capture: 'in_world_action' }, detail);
    }
  };
  const conceptHint = props.station === 's1' ? '想一想：什么问题决定还要不要再观察？怎样才能离开等待？' : props.station === 's2b' ? '判断框的形状一样。沿着箭头走，看看是否会回到做过的步骤。' : props.station === 's2c' ? '读取水温只是看一看，温度不会因此升高。留意真正加热的时机。' : '结合排队情况想：给这一侧更多通行时间，也会让另一侧多等。';
  const guideTarget = playback.hasNext ? 'playback' : passed ? 'run' : props.station === 's1' ? !plan.condition ? 'conditions' : !plan.yes || !plan.no ? 'flow' : 'run' : props.station === 's2b' ? !diagramChoice || !edgeChoice ? 'comparison' : 'run' : props.station === 's2c' ? kettleRuns.length < 2 ? kettleRuns.includes(temperature) ? 'temperature' : 'run' : kettleChoices.some(value => !value) || !timingComparisons.length ? 'kettle' : 'run' : !baseline ? 'run' : !units ? 'duration' : !reason ? 'reason' : 'run';
  const guideSelectors: Record<string, string> = { conditions: '.condition-choices', flow: '.flow-board', run: '.primary-controls', comparison: '.comparison-stage', temperature: '.scene-tests', kettle: '.kettle-questions', duration: '.traffic-duration-choices', reason: '.reason-choices', playback: '.secondary-controls' };
  const guideDirections: Record<string, string> = { conditions: '关闭后，看底部的条件卡片区。', flow: '关闭后，看右侧流程板的两个出口。', run: '关闭后，看底部的运行与确认区。', comparison: '关闭后，看中间两张流程图与箭头。', temperature: '关闭后，看场景下方的水温运行区。', kettle: '关闭后，看底部的流程认读区。', duration: '关闭后，看绿灯时长区。', reason: '关闭后，看时长下面的理由区。', playback: '关闭后，看暂停和单步按钮。' };
  useEffect(() => {
    if (!guideActive || help || learnOpen || mazeOpen || timingOpen) return;
    const element = panelRef.current?.querySelector<HTMLElement>(guideSelectors[guideTarget]);
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [guideActive, guideTarget, help, learnOpen, mazeOpen, timingOpen]);

  return <section ref={panelRef} className={`station-panel ${guideActive && !help && !learnOpen && !mazeOpen && !timingOpen ? `has-guide guide-${guideTarget}` : ''}`} data-guide-target={guideActive ? guideTarget : undefined} aria-label={`${names[props.station][0]}学习任务`}>
    <header className="station-heading">
      <button className="round-tool" onClick={close} aria-label="返回路口"><ArrowLeft size={22}/></button>
      <div className="station-title"><span>临时小交警 · {names[props.station][0]}</span><h1>{names[props.station][1]}</h1></div>
      <button className="help-button learn-button" onClick={() => { pauseForHelp(); setLearnOpen(true); }}><BookOpen size={20}/>先学卡</button>
      <button className="help-button" onClick={() => { pauseForHelp(); setHelp('先选择卡片；点“是／否”再点目标框就能接线。运行时可以暂停、单步。撤回不会扣分。'); }}><HelpCircle size={20}/>操作帮助</button>
      <button className="relic-button" disabled={(props.relicRemaining ?? 3) <= 0} onClick={() => { if ((props.relicRemaining ?? 3) <= 0) return; pauseForHelp(); markSupport('concept_support'); props.onUseRelic?.(); setGuideActive(true); setHelp(`${conceptHint} ${guideDirections[guideTarget]}`); }}><Sparkles size={21}/>通关法宝 <b>{props.relicRemaining ?? 3}/3</b></button>
    </header>
    <div className="station-task"><span className="task-dot"/><p>{hint}</p>{playback.trace.length > 0 && <span className="trace-count">执行 {playback.index + 1}/{playback.trace.length}</span>}</div>
    {props.station === 's2b' ? <div className="comparison-stage">
      {[['loop', '方案甲', crossingNodes('绿灯未亮起？', false), loopEdges], ['branch', '方案乙', branchNodes, branchEdges]].map(([id, label, nodes, edges]) => <div className={`comparison-card ${diagramChoice === id ? 'is-selected' : ''}`} key={id as string}>
        <button className="diagram-choice" aria-pressed={diagramChoice === id} onClick={() => { setComparisonHistory(old => [...old, { diagramChoice, edgeChoice }]); invalidate(); setDiagramChoice(id as 'loop' | 'branch'); setEdgeChoice(''); }}>{label as string}{diagramChoice === id && <Check size={18}/>}</button>
        <FlowDiagram nodes={nodes as DiagramNode[]} edges={edges as DiagramEdge[]} selectedEdge={diagramChoice === id ? edgeChoice : ''} onNodeSelect={() => { if (diagramChoice !== id) { setComparisonHistory(old => [...old, { diagramChoice, edgeChoice }]); invalidate(); setDiagramChoice(id as 'loop' | 'branch'); setEdgeChoice(''); } }} onEdgeSelect={edgeId => { setComparisonHistory(old => [...old, { diagramChoice, edgeChoice }]); invalidate(); setDiagramChoice(id as 'loop' | 'branch'); setEdgeChoice(edgeId); }} label={`${label}流程图`}/>
      </div>)}
    </div> : <div className="station-workspace">
      <div className="scene-frame">
        <LessonScene kind={props.station === 's2c' ? 'kettle' : props.station === 's3' ? 'traffic' : 'crossing'} step={playback.step || (props.station === 's3' && trafficResult ? trafficResult.trace[trafficResult.trace.length - 1] : undefined)} crossingCase={crossingCase} running={playback.running} initialTemperature={temperature}/>
        <div className="scene-tests">
          {props.station === 's1' && (['green_at_start', 'red_then_green'] as CrossingCaseId[]).map(id => <button disabled={playback.running} key={id} className={crossingCase === id ? 'selected' : ''} onClick={() => { playback.stop(); setCrossingCase(id); }}>{crossingResults[id] && <Check size={16}/>} {id === 'green_at_start' ? '到达时已是绿灯' : '先红灯，后来变绿'}</button>)}
          {props.station === 's2c' && ([80, 100] as const).map(t => <button key={t} disabled={playback.running} className={temperature === t ? 'selected' : ''} onClick={() => { playback.stop(); setTemperature(t); }}>{kettleRuns.includes(t) && <Check size={16}/>}开始时 {t}℃</button>)}
          {props.station === 's3' && <div className="traffic-comparison"><span>原方案：还等 <b>{baseline ? 9 : '—'}</b> 辆</span><span>上次运行：还等 <b>{trafficResult?.remainingCars ?? '—'}</b> 辆</span></div>}
        </div>
      </div>
      <div className="flow-board">
        <span className="board-tab">{props.station === 's1' ? '我的过马路流程' : props.station === 's2c' ? '热水壶怎样工作' : '这一轮信号安排'}</span>
        {props.station === 's1' && <FlowDiagram nodes={crossingNodes(conditionCards.find(c => c[0] === plan.condition)?.[1])} edges={[...crossingFixed, ...(plan.condition ? [{ id: 'observe_decide', from: 'observe', to: 'decide' }] : []), ...(plan.yes ? [{ id: 'yes', from: 'decide', to: plan.yes, branch: 'yes' as const, back: ['observe', 'start'].includes(plan.yes), label: '是' }] : []), ...(plan.no ? [{ id: 'no', from: 'decide', to: plan.no, branch: 'no' as const, back: ['observe', 'start'].includes(plan.no), label: '否' }] : [])]} activeNode={playback.step?.nodeId} nextNodeId={playback.trace[playback.index + 1]?.nodeId} selectedBranch={branch} onPortSelect={port => { if (!playback.running && plan.condition) setBranch(port); }} onNodeSelect={id => { if (!playback.running && branch && ['start', 'observe', 'cross', 'end'].includes(id)) updatePlan({ ...plan, [branch]: id }); }}/>}
        {props.station === 's2c' && <FlowDiagram nodes={kettleNodes} edges={kettleEdges} activeNode={playback.step?.nodeId} nextNodeId={playback.trace[playback.index + 1]?.nodeId}/>}
        {props.station === 's3' && <>
          <FlowDiagram nodes={[{ id: 'green', label: `待运行：绿灯 ${units || 3} 格`, kind: 'process', x: 90, y: 0 }, { id: 'pedestrian', label: '行人阶段 6 格', kind: 'process', x: 90, y: 100 }, { id: 'end', label: '下一轮', kind: 'start', x: 90, y: 200 }]} edges={[{ id: 'signal_next', from: 'green', to: 'pedestrian' }, { id: 'signal_repeat', from: 'pedestrian', to: 'end' }, { id: 'signal_again', from: 'end', to: 'green', back: true }]} activeNode={playback.step?.nodeId} nextNodeId={playback.trace[playback.index + 1]?.nodeId}/>
          <p className="traffic-limit">同一组12辆车；每格最多通过1辆。<br/>行人阶段始终固定6格。<br/>{trafficResult ? `另一方向等待 ${trafficResult.otherDirectionWaitUnits} 格。` : '格数不代表真实路口时长。'}</p>
        </>}
      </div>
    </div>}
    <div className="station-bottom">
      <div className={`station-feedback ${passed ? 'success' : ''}`} data-scaffold-level={!passed && feedback ? scaffoldLevel : 0} aria-live="polite">{passed ? <Check size={19}/> : scaffoldLevel && feedback ? <strong className="scaffold-badge">{scaffoldLevel === 1 ? '观察提示' : scaffoldLevel === 2 ? '线索提示' : '换例子想想'}</strong> : <span className="small-arrow">↳</span>}<span>{feedback || (props.station === 's1' ? '把条件和两条箭头补好，再看看行人怎样走。' : props.station === 's2b' ? '选好图和箭头后，再检查你的想法。' : props.station === 's2c' ? '读取水温和加热，是两种不同的动作。' : '先观察原方案，再让调整产生可以比较的结果。')}</span></div>
      {props.station === 's1' && <div className="choice-row condition-choices">{conditionCards.map(([id, text]) => <button key={id} className={`lesson-choice ${plan.condition === id ? 'selected' : ''}`} disabled={playback.running} onClick={() => updatePlan({ ...plan, condition: id })}>{text}</button>)}</div>}
      {props.station === 's2c' && <div className="kettle-questions">
        <div className="question-tabs">{['反复做什么', '什么时候停', '先后会怎样'].map((q, i) => <button key={q} onClick={() => setKettleStage(i)} className={kettleStage === i ? 'selected' : ''}>{kettleChoices[i] ? <Check size={16}/> : <span>{i + 1}</span>}{q}</button>)}</div>
        {kettleStage < 2 ? <div className="choice-row">{(kettleStage === 0 ? [['read', '读取水温'], ['heat', '继续加热'], ['stop', '停止加热']] : [['at100', '达到100℃时'], ['below', '低于100℃时'], ['everytime', '每次判断后都停']]).map(([id, text]) => <button key={id} disabled={playback.running} className={`lesson-choice ${kettleChoices[kettleStage] === id ? 'selected' : ''}`} onClick={() => { setKettleHistory(old => [...old, { choices: [...kettleChoices], stage: kettleStage }]); invalidate(); setKettleChoices(old => old.map((v, i) => i === kettleStage ? id : v)); }}>{text}</button>)}<button className="next-question" disabled={!kettleChoices[kettleStage]} onClick={() => setKettleStage(i => i + 1)}>下一项<ChevronRight size={18}/></button></div> : <div className="choice-row timing-entry-row"><button className="lesson-choice timing-entry" onClick={() => { pauseForHelp(); setTimingOpen(true); }}><Repeat2 size={20}/>{timingComparisons.length ? '重看先后对照' : '比较：先检查，还是先擦一下？'}</button>{timingComparisons.length > 0 && <span className="timing-prediction-summary">我的预测：{kettleChoices[2] === 'ask' ? '甲' : '乙'}可能一次也不擦</span>}</div>}
      </div>}
      {props.station === 's3' && <div className="traffic-choices"><div className="choice-row traffic-duration-choices">{([3, 6, 9] as const).map(u => <button key={u} disabled={!baseline || playback.running} className={`lesson-choice ${units === u ? 'selected' : ''}`} onClick={() => { setTrafficEdits(old => [...old, { units, reason }]); invalidate(); setUnits(u); }}>绿灯 {u} 格</button>)}</div><div className="choice-row reason-choices">{[['rs_evacuate', '让等待较多的这一侧多通行一些'], ['rs_equal', '每个方向时长都必须一样'], ['rs_cycle_only', '只要灯会循环，时长没有作用']].map(([id, text]) => <button key={id} disabled={!baseline || playback.running} className={`lesson-choice ${reason === id ? 'selected' : ''}`} onClick={() => { setTrafficEdits(old => [...old, { units, reason }]); invalidate(); setReason(id); }}>{text}</button>)}</div></div>}
      <div className="station-controls">
        <div className="secondary-controls"><button onClick={undo} disabled={playback.running}><Undo2 size={19}/>撤回上一步</button>{props.station !== 's2b' && <><button disabled={!playback.hasNext} onClick={playback.toggle}>{playback.running ? <Pause size={19}/> : <Play size={19}/>} {playback.running ? '暂停' : '继续'}</button><button disabled={!ready || (playback.trace.length > 0 && !playback.hasNext)} onClick={() => playback.trace.length ? playback.advance() : startPlayback(false)}><SkipForward size={19}/>单步</button><button disabled={!ready || playback.running} onClick={() => startPlayback()}><RotateCcw size={19}/>重试本次</button></>}<button disabled={!props.onRestart} onClick={() => { playback.stop(); props.onRestart?.(); }}><RotateCcw size={19}/>重做本关</button></div>
        <div className="primary-controls">
          {props.station === 's2c' && passed && <button className="check-button" onClick={() => { playback.stop(); setMazeOpen(true); }}>选做：巡检小车</button>}
          {props.station === 's2b' && !passed && <button className="run-button" disabled={!diagramChoice || !edgeChoice} onClick={checkComparison}>检查我的判断<ChevronRight size={20}/></button>}
          {props.station === 's2c' && !passed && <button className="check-button" disabled={kettleChoices.some(v => !v) || kettleRuns.length < 2 || !timingComparisons.length || playback.running} onClick={checkKettle}>检查我的选择<Check size={20}/></button>}
          {props.station !== 's2b' && !passed && <button className="run-button" disabled={!ready || playback.running} onClick={() => startPlayback()}><Play size={22} fill="currentColor"/>{props.station === 's3' && !baseline ? '运行原方案' : props.station === 's2c' ? `运行 ${temperature}℃` : '运行'}</button>}
          {passed && <button className="run-button complete-button" onClick={mainAction}>{mainText}<ChevronRight size={24}/></button>}
        </div>
      </div>
    </div>
    {mazeOpen && <MazeTransfer onClose={() => setMazeOpen(false)} onEvidence={props.onEvidence}/>}
    {timingOpen && <TimingComparison onClose={() => setTimingOpen(false)} initialPrediction={kettleChoices[2] === 'ask' ? 'ask' : kettleChoices[2] === 'heatFirst' ? 'doFirst' : undefined} onResult={result => {
      setKettleHistory(old => [...old, { choices: [...kettleChoices], stage: 2 }]);
      invalidate();
      setKettleChoices(old => old.map((value, index) => index === 2 ? result.prediction === 'ask' ? 'ask' : 'heatFirst' : value));
      setTimingComparisons(old => [...old, result]);
      emit('scenario_run', { kind: 'timing_comparison', comparison: result }, result.prediction === 'ask');
    }}/>}
    {learnOpen && <div className="lesson-help-backdrop lesson-learn-backdrop"><aside className="lesson-learn" role="dialog" aria-modal="true" aria-labelledby="lesson-learn-title"><button className="help-close" onClick={dismissLearn} aria-label="关闭先学卡"><X size={24}/></button><div className="learn-card-title"><BookOpen size={25}/><div><span>先学卡 · 随时可以重看</span><h2 id="lesson-learn-title">{learnCards[props.station].title}</h2></div></div><img src={`/lesson/textbook-${learnCards[props.station].image}.png`} alt={`教材第${learnCards[props.station].page}页相关图示`}/><p className="learn-source">教材第{learnCards[props.station].page}页</p><div className="learn-sentences">{learnCards[props.station].lines.map(line => <p key={line}>{line}</p>)}</div><button className="run-button" onClick={dismissLearn}>开始探究<ChevronRight size={22}/></button></aside></div>}
    {help && <div className="lesson-help-backdrop" role="presentation"><aside className="lesson-help" role="dialog" aria-modal="true" aria-label="帮助"><button className="help-close" onClick={() => setHelp('')} aria-label="关闭帮助"><X size={24}/></button><Sparkles size={28}/><h2>看看这一步</h2><p>{help}</p><button className="check-button" onClick={() => setHelp('')}>我来试试</button></aside></div>}
  </section>;
}

export { StationPanel };
