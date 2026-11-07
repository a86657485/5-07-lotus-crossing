import React, { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, SkipForward, X } from 'lucide-react';

type Action = 'check' | 'decide' | 'wipe' | 'end';
export type TimingPrediction = 'ask' | 'doFirst';
export function runTimingComparison(initialClean = true) {
  const ask: Action[] = initialClean ? ['check', 'decide', 'end'] : ['check', 'decide', 'wipe', 'check', 'decide', 'end'];
  const doFirst: Action[] = ['wipe', 'check', 'decide', 'end'];
  return { initialClean, traces: { ask, doFirst }, wipeCounts: { ask: ask.filter(action => action === 'wipe').length, doFirst: doFirst.filter(action => action === 'wipe').length } };
}
export type TimingComparisonResult = ReturnType<typeof runTimingComparison> & { prediction: TimingPrediction };
type Props = { onClose: () => void; onResult: (result: TimingComparisonResult) => void; initialPrediction?: TimingPrediction };

function MiniFlow({ kind, active }: { kind: TimingPrediction; active?: Action }) {
  const node = (id: Action, label: string, x: number, y: number) => <g className={active === id ? 'timing-node active' : 'timing-node'} data-action={id}><rect x={x} y={y} width="120" height="38" rx="12"/><text x={x + 60} y={y + 24}>{label}</text></g>;
  const diamondY = kind === 'ask' ? 140 : 195;
  return <svg className="timing-flow" viewBox="0 0 360 325" aria-label={kind === 'ask' ? '甲流程：先检查，再判断是否需要擦' : '乙流程：先擦一下，再检查判断'}>
    <defs><marker id={`timing-arrow-${kind}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#4887b6"/></marker></defs>
    <g className="timing-arrows" markerEnd={`url(#timing-arrow-${kind})`}>
      {kind === 'ask' ? <><path d="M180 53V104"/><path d="M110 140H70V188"/><path d="M70 226H28V34H118"/><path d="M180 176V268"/></> : <><path d="M180 53V88"/><path d="M180 128V159"/><path d="M110 195H35V34H118"/><path d="M180 231V268"/></>}
    </g>
    {kind === 'ask' ? <>{node('check', '检查桌面', 120, 15)}{node('wipe', '擦一下', 10, 188)}</> : <>{node('wipe', '先擦一下', 120, 15)}{node('check', '检查桌面', 120, 90)}</>}
    <g className={active === 'decide' ? 'timing-node decision active' : 'timing-node decision'} data-action="decide"><path d={`M180 ${diamondY - 36}L250 ${diamondY}L180 ${diamondY + 36}L110 ${diamondY}Z`}/><text x="180" y={diamondY + 5}>还需要擦吗？</text></g>
    <text className="timing-branch-word" x={kind === 'ask' ? 79 : 57} y={diamondY - 9}>是</text><text className="timing-branch-word" x="190" y={diamondY + 65}>否</text>
    {node('end', '结束', 120, 270)}
  </svg>;
}

export default function TimingComparison({ onClose, onResult, initialPrediction }: Props) {
  const model = useRef(runTimingComparison(true)).current;
  const [prediction, setPrediction] = useState<TimingPrediction | ''>(initialPrediction || '');
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const reported = useRef(false);
  const total = Math.max(model.traces.ask.length, model.traces.doFirst.length);
  const finished = cursor >= total - 1;
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  useEffect(() => {
    if (!playing || finished) return;
    const timer = window.setTimeout(() => setCursor(index => index + 1), 850);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, finished]);
  useEffect(() => {
    if (!finished || !prediction || reported.current) return;
    reported.current = true;
    setPlaying(false);
    onResult({ ...model, prediction });
  }, [finished, prediction, model, onResult]);
  const current = (kind: TimingPrediction) => cursor < 0 ? undefined : model.traces[kind][Math.min(cursor, model.traces[kind].length - 1)];
  const wipesSoFar = (kind: TimingPrediction) => cursor < 0 ? '—' : model.traces[kind].slice(0, cursor + 1).filter(action => action === 'wipe').length;
  const choose = (value: TimingPrediction) => { setPrediction(value); setCursor(-1); setPlaying(false); reported.current = false; };
  const run = (auto: boolean) => { if (!prediction) return; reported.current = false; setCursor(0); setPlaying(auto); };
  return <div className="lesson-help-backdrop timing-backdrop"><section className="timing-comparison" role="dialog" aria-modal="true" aria-labelledby="timing-title">
    <button className="help-close" onClick={onClose} aria-label="关闭先后对照"><X size={24}/></button>
    <span className="timing-kicker">换个小例子，看看先后</span><h2 id="timing-title">桌面已经干净，哪种可能一次也不擦？</h2>
    <p className="timing-condition"><span aria-hidden="true">✧</span>两张桌面开始时都干净。先选一张，再运行比较。</p>
    <div className="timing-flow-pair">{(['ask', 'doFirst'] as const).map(kind => <div className={`timing-flow-card ${prediction === kind ? 'selected' : ''}`} key={kind}>
      <button className="timing-predict" aria-pressed={prediction === kind} disabled={playing} onClick={() => choose(kind)}>我预测：{kind === 'ask' ? '甲' : '乙'}可能不擦{prediction === kind && <Check size={17}/>}</button>
      <MiniFlow kind={kind} active={current(kind)}/>
      <div className="timing-counter">已经擦了 <b>{wipesSoFar(kind)}</b> 次</div>
    </div>)}</div>
    <p className="timing-feedback" aria-live="polite">{cursor < 0 ? '沿箭头看看：两张图第一次做的事一样吗？' : cursor === 0 ? '甲先检查桌面，乙先擦一下。第一步就不同。' : finished ? `桌面本来已干净：甲擦了${model.wipeCounts.ask}次，乙擦了${model.wipeCounts.doFirst}次。判断的位置会改变第一次是否执行。` : '继续沿箭头看，两张图怎样结束。'}</p>
    <div className="timing-controls"><div><button className="check-button" disabled={cursor < 0 || finished} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={18}/> : <Play size={18}/>} {playing ? '暂停' : '继续'}</button><button className="check-button" disabled={!prediction || finished} onClick={() => { if (cursor < 0) run(false); else { setPlaying(false); setCursor(index => index + 1); } }}><SkipForward size={18}/>单步</button></div>{finished ? <button className="run-button" onClick={onClose}>回到热水壶<Check size={20}/></button> : <button className="run-button" disabled={!prediction || playing} onClick={() => run(true)}><Play size={20}/>运行对比</button>}</div>
  </section></div>;
}
