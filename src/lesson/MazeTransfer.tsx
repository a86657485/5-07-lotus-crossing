import React, { useEffect, useRef, useState } from 'react';
import { simulateMaze, type MazePlan } from './model';
import './maze.css';

export interface MazeTransferProps {
  onClose: () => void;
  onEvidence?: (envelope: Record<string, unknown>) => void;
}

const conditions: Array<{ id: MazePlan['condition']; label: string }> = [
  { id: 'at_goal', label: '已经到检查点？' },
  { id: 'not_at_goal', label: '还没到检查点？' },
  { id: 'steps_three', label: '已经走了三步？' },
];
const actions: Array<{ id: MazePlan['action']; label: string }> = [
  { id: 'wait', label: '原地等待' },
  { id: 'forward', label: '前进一步' },
];

/** Optional transfer task: this never sets a required station completion flag. */
export default function MazeTransfer({ onClose, onEvidence }: MazeTransferProps) {
  const [plan, setPlan] = useState<MazePlan>({ condition: '', action: '' });
  const [history, setHistory] = useState<MazePlan[]>([]);
  const [length, setLength] = useState<3 | 5>(3);
  const [run, setRun] = useState<ReturnType<typeof simulateMaze> | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [verified, setVerified] = useState<Array<3 | 5>>([]);
  const [finished, setFinished] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  useEffect(() => {
    if (!run) return;
    if (cursor >= run.trace.length - 1) { finishRun(); return; }
    if (!playing) return;
    const timer = window.setTimeout(() => setCursor(index => index + 1), 550);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, run]);

  const step = run?.trace[cursor];
  const position = step?.position ?? 0;
  const complete = verified.includes(3) && verified.includes(5);
  const canRun = !!plan.condition && !!plan.action;
  const running = !!run && !finished;

  function finishRun() {
    if (!run || reported.current) return;
    reported.current = true;
    setPlaying(false);
    setFinished(true);
    if (run.correct) setVerified(items => items.includes(length) ? items : [...items, length]);
    onEvidence?.({
      eventId: `maze-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      taskId: 's2_kettle', eventType: 'scenario_run', correct: run.correct,
      payload: { optional: true, scenario: 'maze_transfer', plan: { ...plan }, distance: length, outcome: run.outcome, trace: run.trace },
    });
  }

  function changePlan(next: MazePlan) {
    if (next.condition === plan.condition && next.action === plan.action) return;
    setHistory(items => [...items, { ...plan }]);
    setPlan(next);
    setRun(null); setCursor(0); setPlaying(false); setFinished(false); setVerified([]);
  }

  function startRun() {
    if (!canRun) return;
    reported.current = false;
    setRun(simulateMaze(plan, length));
    setCursor(0); setPlaying(true); setFinished(false);
  }

  function nextStep() {
    if (!run) {
      if (!canRun) return;
      reported.current = false;
      setRun(simulateMaze(plan, length)); setCursor(0); setPlaying(false); setFinished(false);
    } else if (cursor < run.trace.length - 1) {
      setPlaying(false); setCursor(index => index + 1);
    } else finishRun();
  }

  function undo() {
    if (!history.length) return;
    setPlan(history[history.length - 1]);
    setHistory(items => items.slice(0, -1));
    setRun(null); setCursor(0); setPlaying(false); setFinished(false); setVerified([]);
  }

  function changeLength(next: 3 | 5) {
    setLength(next); setRun(null); setCursor(0); setPlaying(false); setFinished(false);
  }

  return (
    <section className="maze-transfer" role="dialog" aria-modal="true" aria-labelledby="maze-title">
      <div className="maze-transfer__card">
        <header className="maze-transfer__header">
          <div><span className="maze-transfer__tag">选做 · 换个地方试一试</span><h2 id="maze-title">巡检小车出发啦</h2></div>
          <button className="maze-transfer__close" onClick={onClose} aria-label="关闭巡检小车">×</button>
        </header>
        <p className="maze-transfer__task">帮小车沿安全步道到检查点。换条步道，规则还管用吗？</p>
        <div className="maze-transfer__body">
          <div className="maze-transfer__scene">
            <div className="maze-transfer__route-choice" aria-label="选择步道">
              <button className={length === 3 ? 'is-selected' : ''} disabled={running} onClick={() => changeLength(3)}>短步道 {verified.includes(3) ? '✓' : ''}</button>
              <button className={length === 5 ? 'is-selected' : ''} disabled={running} onClick={() => changeLength(5)}>长步道 {verified.includes(5) ? '✓' : ''}</button>
            </div>
            <div className="maze-transfer__path" style={{ gridTemplateColumns: `repeat(${length + 1}, 1fr)` }}>
              {Array.from({ length: length + 1 }, (_, index) => <div key={index} className={`maze-transfer__tile ${position === index ? 'has-car' : ''}`}>
                {index === length && <span className="maze-transfer__flag" aria-label="检查点">⚑</span>}
                {position === index && <svg className="maze-transfer__car" viewBox="0 0 64 50" role="img" aria-label="巡检小车">
                  <path d="M13 24 19 10h27l7 14v15H8V26z" fill="#f7a63d" stroke="#5c4e36" strokeWidth="2" />
                  <path d="m23 14-5 11h29l-5-11z" fill="#cce9fa" stroke="#5c4e36" strokeWidth="2" />
                  <circle cx="18" cy="39" r="7" fill="#314b61" /><circle cx="46" cy="39" r="7" fill="#314b61" />
                  <path d="M9 28h8m29 0h7" stroke="#fff9dc" strokeWidth="5" />
                </svg>}
                <small>{index === 0 ? '出发' : index === length ? '检查点' : ''}</small>
              </div>)}
            </div>
            <p className="maze-transfer__status" aria-live="polite">{step?.label || '先安排判断条件和动作，再试一试。'}</p>
            <div className="maze-transfer__trace" aria-label="执行位置">
              <span className={step?.nodeId === 'decide' ? 'is-current' : ''}>判断</span><b>→</b>
              <span className={step?.nodeId === 'move' || step?.nodeId === 'wait' ? 'is-current' : ''}>动作</span><b>↩</b>
              <span className={step?.nodeId === 'end' ? 'is-current' : ''}>停止</span>
            </div>
          </div>
          <div className="maze-transfer__program">
            <fieldset disabled={running}><legend>先问一句</legend><div className="maze-transfer__choices">
              {conditions.map(item => <button key={item.id} aria-pressed={plan.condition === item.id} onClick={() => changePlan({ ...plan, condition: item.id })}>{item.label}</button>)}
            </div></fieldset>
            <fieldset disabled={running || !plan.condition}><legend>回答“是”时做什么？</legend><div className="maze-transfer__choices">
              {actions.map(item => <button key={item.id} aria-pressed={plan.action === item.id} onClick={() => changePlan({ ...plan, action: item.id })}>{item.label}</button>)}
            </div></fieldset>
            <p className="maze-transfer__rule">做完动作，再回去问一次；回答“否”时停止。</p>
          </div>
        </div>
        <footer className="maze-transfer__footer">
          <button className="maze-transfer__run" disabled={!canRun} onClick={() => playing ? setPlaying(false) : run && !finished ? setPlaying(true) : startRun()}>{playing ? 'Ⅱ 暂停' : run && !finished ? '▶ 继续运行' : '▶ 运行'}</button>
          <button disabled={!canRun || finished} onClick={nextStep}>走一步</button>
          <button disabled={!run} onClick={startRun}>重新运行</button>
          <button disabled={running || !history.length} onClick={undo}>⌫ 撤回选择</button>
          <button onClick={onClose}>返回主线</button>
        </footer>
        <p className={`maze-transfer__feedback ${complete ? 'is-complete' : ''}`} aria-live="polite">
          {complete ? '两条步道都到达了！同一个条件，能控制不同次数的重复。'
            : finished && run?.correct ? '这条步道到达了。保留规则，换条步道再验证。'
            : finished ? '小车的结果与你想的一样吗？改一处，再试一次。'
            : '这是选做迁移任务，不影响主线与考核。'}
        </p>
      </div>
    </section>
  );
}
