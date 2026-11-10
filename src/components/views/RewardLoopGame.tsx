import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronRight, CircleHelp, Droplets, Flag, Gauge, GitFork,
  LockKeyhole, Package, Play, Repeat2, RotateCcw, TrainFront, Wrench, X,
} from 'lucide-react';
import {
  createTrainRound, TRAIN_LAP_LIMIT, TRAIN_ORDER_INDICES, TRAIN_ORDERS, trainRoundReducer,
  type CargoKind, type TrainAction, type TrainOrderIndex, type TrainResultInput, type TrainRound, type TrainRule,
} from '../../lesson/trainReward';
import { TrainRewardScene } from './TrainRewardScene';
import './trainReward.css';

interface RewardLoopGameProps {
  onBackToMap: () => void;
  onRecordResult: (input: TrainResultInput) => Promise<{ bestLaps: number }>;
}

const ORDER_NUMBERS = ['一', '二', '三', '四', '五'] as const;
const CARGO = {
  water: { name: '水', station: '水站', Icon: Droplets },
  tools: { name: '工具', station: '工具站', Icon: Wrench },
};
const CARGO_KINDS = ['water', 'tools'] as const;
const RULES = [
  { value: 'three', title: '固定跑 3 圈', detail: '数满 3 圈就回库' },
  { value: 'fulfilled', title: '装齐才回库', detail: '有一项没齐就继续跑' },
] as const;

const PHASE_TIMING = {
  locked: { normal: 780, fast: 550, next: 'load' },
  loading: { normal: 1000, fast: 760, next: 'check' },
  checking: { normal: 1700, fast: 1250, next: 'continue' },
  depot: { normal: 950, fast: 720, next: 'finish' },
} as const;

const SWITCH_WINDOWS = {
  normal: [3000, 3000, 2700, 2400, 2100],
  fast: [1900, 1900, 1700, 1600, 1400],
} as const;

type Speed = 'normal' | 'fast';
type RewardAction = TrainAction | { type: 'setup'; orderIndex: TrainOrderIndex; rule: TrainRule };
type RecordStatus = { status: 'idle' | 'saving' | 'failed' } | { status: 'saved'; bestLaps: number };

function rewardReducer(round: TrainRound, action: RewardAction) {
  return action.type === 'setup'
    ? createTrainRound(action.orderIndex, action.rule)
    : trainRoundReducer(round, action);
}

function useTrainProgress(
  phase: TrainRound['phase'],
  completedRounds: number,
  speed: Speed,
  switchWindow: number,
  paused: boolean,
  dispatch: (action: TrainAction) => void,
) {
  const key = phase + completedRounds;
  const clock = useRef({ key, elapsed: 0 });
  const [frame, setFrame] = useState({ key, progress: 0 });
  const timing = phase === 'ready' || phase === 'approach' || phase === 'done' ? null : PHASE_TIMING[phase];
  const duration = phase === 'approach' ? switchWindow : timing?.[speed];
  const next = phase === 'approach' ? 'lock' : timing?.next;

  useLayoutEffect(() => {
    if (clock.current.key !== key) clock.current = { key, elapsed: 0 };
    if (paused || !duration || !next) return;

    let frameId = 0;
    let previousTime: number | undefined;
    let lastPaint = 0;
    function animate(time: number) {
      if (previousTime !== undefined) clock.current.elapsed += Math.min(time - previousTime, 100);
      previousTime = time;
      const progress = Math.min(clock.current.elapsed / duration, 1);
      if (time - lastPaint >= 32 || progress === 1) {
        setFrame({ key, progress });
        lastPaint = time;
      }
      if (progress === 1) {
        dispatch({ type: next });
      } else {
        frameId = requestAnimationFrame(animate);
      }
    }
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [key, paused, duration, next, dispatch]);

  return frame.key === key ? frame.progress : 0;
}

function getScene(round: TrainRound, progress: number) {
  const direction = round.committedLane ?? round.lane;
  switch (round.phase) {
    case 'ready':
      return { segment: 'idle', progress: 0, direction } as const;
    case 'approach':
      return { segment: 'approach', progress, direction } as const;
    case 'locked':
      return { segment: direction, progress: progress * 0.45, direction } as const;
    case 'loading':
      return { segment: direction, progress: 0.45, direction } as const;
    case 'checking':
      return { segment: direction, progress: 0.45 + progress * 0.55, direction } as const;
    case 'depot':
      return { segment: 'depot', progress, direction } as const;
    case 'done':
      return { segment: 'depot', progress: 1, direction } as const;
  }
}

function CargoMeter({ kind, count, target }: { kind: CargoKind; count: number; target: number }) {
  const { Icon, name } = CARGO[kind];
  return (
    <div className="train-cargo-meter" data-cargo={kind}>
      <span className="train-cargo-icon" aria-hidden="true"><Icon size={19} /></span>
      <span className="train-cargo-label">{name}</span>
      <span className="train-cargo-slots" aria-hidden="true">
        {Array.from({ length: target }, (_, index) => (
          <span key={index} data-filled={index < count}><Package size={17} /></span>
        ))}
      </span>
      <strong className="train-cargo-total" aria-label={`已装 ${count} 箱，共需 ${target} 箱`}>
        {count}<small>/{target}</small>
      </strong>
    </div>
  );
}

export function RewardLoopGame({ onBackToMap, onRecordResult }: RewardLoopGameProps) {
  const [round, dispatch] = useReducer(rewardReducer, undefined, () => createTrainRound(0, 'three'));
  const [speed, setSpeed] = useState<Speed>('normal');
  const [helpOpen, setHelpOpen] = useState(false);
  const [lateLap, setLateLap] = useState<number | null>(null);
  const [recordStatus, setRecordStatus] = useState<RecordStatus>({ status: 'idle' });
  const recordInFlight = useRef(false);
  const switchButton = useRef<HTMLButtonElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const { phase, cargo, order, orderIndex, rule, route, lane, completedRounds, lastLoad, result } = round;
  const isReady = phase === 'ready';
  const isDone = phase === 'done';
  const switchOpen = phase === 'approach';
  const switchWindow = SWITCH_WINDOWS[speed][orderIndex];
  const progress = useTrainProgress(phase, completedRounds, speed, switchWindow, helpOpen, dispatch);
  const scene = getScene(round, progress);
  const currentRule = RULES[rule === 'three' ? 0 : 1];
  const lap = phase === 'checking' || phase === 'depot' || isDone ? completedRounds : completedRounds + 1;
  const remainingSeconds = Math.max(0.1, Math.ceil((1 - progress) * switchWindow / 100) / 10);
  const leavingCheck = phase === 'checking' && progress >= 0.58;
  const step = phase === 'ready' ? -1
    : phase === 'approach' || phase === 'locked' ? 0
    : phase === 'loading' ? 1
    : phase === 'checking' && !leavingCheck ? 2
    : 3;
  const nextStep = result ? '回库' : leavingCheck ? '再跑一圈' : '再跑或回库';
  const minimumLaps = order.water + order.tools;
  const reachedLapLimit = result === 'short' && rule === 'fulfilled';
  const waitingForReceipt = result === 'filled' && (recordStatus.status === 'idle' || recordStatus.status === 'saving');

  const saveResult = useCallback(async () => {
    if (recordInFlight.current) return;
    recordInFlight.current = true;
    setRecordStatus({ status: 'saving' });
    try {
      const { bestLaps } = await onRecordResult({ orderIndex, rule, route });
      setRecordStatus({ status: 'saved', bestLaps });
    } catch {
      setRecordStatus({ status: 'failed' });
    } finally {
      recordInFlight.current = false;
    }
  }, [onRecordResult, orderIndex, rule, route]);

  useEffect(() => {
    if (isDone && result === 'filled' && recordStatus.status === 'idle') void saveResult();
  }, [isDone, result, recordStatus.status, saveResult]);

  useEffect(() => {
    if (phase === 'approach' && completedRounds === 0) switchButton.current?.focus();
    if (phase === 'done') resultHeading.current?.focus();
  }, [phase, completedRounds]);

  function setup(orderIndex: TrainOrderIndex, nextRule: TrainRule) {
    dispatch({ type: 'setup', orderIndex, rule: nextRule });
    setLateLap(null);
    setRecordStatus({ status: 'idle' });
    if (isDone) requestAnimationFrame(() => startButton.current?.focus());
  }

  function switchTrack() {
    if (switchOpen) {
      dispatch({ type: 'switch' });
    } else if (phase === 'locked' || phase === 'loading' || phase === 'checking') {
      setLateLap(lap);
    }
  }

  function openHelp() {
    helpDialog.current?.showModal();
    setHelpOpen(true);
  }

  function closeHelp() {
    setHelpOpen(false);
    helpButton.current?.focus();
  }

  let statusTitle = '小火车已就位';
  let statusDetail = '选好订单和规则，再点发车。';
  if (switchOpen) {
    statusTitle = `本圈前往${CARGO[lane].station}`;
    statusDetail = '倒计时结束前，可以点一下道岔换站。';
  } else if (phase === 'locked') {
    statusTitle = `驶向${CARGO[scene.direction].station}`;
    statusDetail = lateLap === lap ? '道岔已过，这一圈照原路线走。' : '本圈路线已锁定。';
  } else if (phase === 'loading') {
    statusTitle = lastLoad ? `装上 1 箱${CARGO[lastLoad].name}` : `${CARGO[scene.direction].name}已装齐`;
    statusDetail = lastLoad ? '装好一箱，接着核对订单。' : '本圈不再装这类货，接着核对订单。';
  } else if (phase === 'checking') {
    statusTitle = leavingCheck
      ? (result ? '收到回库指令' : '再跑一圈')
      : `第 ${completedRounds} 圈 · 核对订单`;
    statusDetail = rule === 'three'
      ? `已跑 ${completedRounds} / 3 圈${result ? '，按规则回库。' : '，继续跑。'}`
      : reachedLapLimit ? `跑到本趟的 ${TRAIN_LAP_LIMIT} 圈上限，先回库再试。`
      : result ? '两种物资都已装齐，可以回库。' : '订单还没装齐，继续跑。';
  } else if (phase === 'depot') {
    statusTitle = '正在回库';
    statusDetail = result === 'filled' ? '订单装齐了，准备卸货。' : '回库清点还缺的物资。';
  } else if (isDone) {
    statusTitle = '小火车已到库';
    statusDetail = '这一趟结束了，可以再试一张订单。';
  }

  return (
    <div className="train-game">
      <div className="train-shell">
        <header className="train-header">
          <button type="button" className="train-quiet-button" onClick={onBackToMap}>
            <ArrowLeft size={18} aria-hidden="true" /> 返回路口
          </button>
          <div className="train-heading">
            <span className="train-heading-icon" aria-hidden="true"><TrainFront size={29} /></span>
            <div>
              <p>达标奖励小游戏</p>
              <h1>莲花山环线<span> · 抢运物资</span></h1>
            </div>
          </div>
          <button type="button" className="train-quiet-button" ref={helpButton} onClick={openHelp}>
            <CircleHelp size={18} aria-hidden="true" /> 怎么玩
          </button>
        </header>

        <main className="train-layout" data-ready={isReady}>
          <aside className="train-sidebar" aria-label="订单和装货进度">
            {isReady ? (
              <>
                <fieldset className="train-card train-choice">
                  <legend><span>1</span> 选一张订单</legend>
                  <div className="train-order-options">
                    {TRAIN_ORDER_INDICES.map(index => (
                      <label key={index} className="train-order-option" data-selected={orderIndex === index}>
                        <input type="radio" name="train-order" aria-label={`订单${ORDER_NUMBERS[index]} · ${TRAIN_ORDERS[index].name}`} checked={orderIndex === index} onChange={() => setup(index, rule)} />
                        <span aria-hidden="true">{index + 1}</span>
                      </label>
                    ))}
                  </div>
                  <div className="train-option-copy train-order-preview" aria-live="polite">
                    <strong>订单{ORDER_NUMBERS[orderIndex]} · {order.name}</strong>
                    <small className="train-order-contents">
                      <span><Droplets size={14} aria-hidden="true" /> 水 {order.water} 箱</span>
                      <span><Wrench size={14} aria-hidden="true" /> 工具 {order.tools} 箱</span>
                    </small>
                  </div>
                </fieldset>

                <fieldset className="train-card train-choice">
                  <legend><span>2</span> 选循环规则</legend>
                  <div className="train-choice-options">
                    {RULES.map(({ value, title, detail }) => (
                      <label key={value} className="train-option" data-selected={rule === value}>
                        <input type="radio" name="train-rule" checked={rule === value} onChange={() => setup(round.orderIndex, value)} />
                        <span className="train-option-copy"><strong>{title}</strong><small>{detail}</small></span>
                        <span className="train-selection" aria-hidden="true">{rule === value && <Check size={13} />}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="train-speed">
                  <legend><Gauge size={18} aria-hidden="true" /> 车速</legend>
                  <div>
                    {([{ value: 'normal', name: '普通' }, { value: 'fast', name: '快车' }] as const).map(({ value, name }) => (
                      <label key={value} data-selected={speed === value}>
                        <input type="radio" name="train-speed" checked={speed === value} onChange={() => setSpeed(value)} />
                        {name}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="train-tip">
                  <CircleHelp size={17} aria-hidden="true" />
                  <p>每圈只去一个站，最多装一箱。本单每圈可换道 <strong>{switchWindow / 1000} 秒</strong>。</p>
                </div>
              </>
            ) : (
              <>
                <section className="train-card train-manifest" aria-label="当前订单">
                  <p className="train-eyebrow"><Package size={17} aria-hidden="true" /> 订单{ORDER_NUMBERS[orderIndex]}</p>
                  <h2>{order.name}</h2>
                  <div className="train-cargo-list">
                    {CARGO_KINDS.map((kind) => (
                      <CargoMeter key={kind} kind={kind} count={cargo[kind]} target={order[kind]} />
                    ))}
                  </div>
                  <p className="train-rule-chip"><Repeat2 size={16} aria-hidden="true" /> {currentRule.title} <span>已跑 {completedRounds} 圈</span></p>
                </section>

                {isDone ? (
                  <section className="train-outcome train-card" data-filled={result === 'filled'}>
                    <p className="train-eyebrow"><Flag size={17} aria-hidden="true" /> 到库清点</p>
                    <h2 ref={resultHeading} tabIndex={-1}>{result === 'filled' ? '订单完成！' : '订单还差一点'}</h2>
                    <p>
                      {result === 'filled'
                        ? `这趟跑了 ${completedRounds} 圈，水和工具都装齐了。`
                        : `${reachedLapLimit ? `跑到本趟的 ${TRAIN_LAP_LIMIT} 圈上限。` : '固定跑了 3 圈。'}还差 ${CARGO_KINDS.filter((kind) => cargo[kind] < order[kind])
                          .map((kind) => `${order[kind] - cargo[kind]} 箱${CARGO[kind].name}`).join('、')}。`}
                    </p>
                    {result === 'short' && rule === 'three' && minimumLaps > 3 && <p>这张订单要 {minimumLaps} 箱物资，每圈最多装 1 箱。</p>}
                    {result === 'filled' && <p className="train-record-status" data-status={recordStatus.status} role="status">
                      {recordStatus.status === 'saved' ? `已记入排行榜。本单最佳 ${recordStatus.bestLaps} 圈。`
                        : recordStatus.status === 'failed' ? '成绩暂未确认。你可以重试。'
                        : '正在同步成绩…'}
                    </p>}
                    <div className="train-outcome-actions">
                      {recordStatus.status === 'failed' && (
                        <button type="button" className="train-next-button" onClick={() => void saveResult()}>重试同步</button>
                      )}
                      <button type="button" className="train-quiet-button" disabled={waitingForReceipt} onClick={() => setup(orderIndex, rule)}>
                        <RotateCcw size={16} aria-hidden="true" /> 原订单再玩
                      </button>
                      <button type="button" className="train-next-button" disabled={waitingForReceipt}
                        onClick={() => setup(TRAIN_ORDER_INDICES[(orderIndex + 1) % TRAIN_ORDER_INDICES.length], rule)}>
                        {orderIndex === TRAIN_ORDER_INDICES.length - 1 ? '回到订单一' : '下一张订单'} <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="train-tip">
                    <CircleHelp size={17} aria-hidden="true" />
                    <p>先看还差什么，再决定下一圈去哪一站。</p>
                  </div>
                )}
              </>
            )}
          </aside>

          <section className="train-play" aria-label="环线操作台">
            <div className="train-scene">
              <TrainRewardScene
                {...scene}
                switchOpen={switchOpen}
                water={cargo.water}
                tools={cargo.tools}
                loadingCargo={phase === 'loading' ? lastLoad : null}
              />
            </div>

            <div className="train-console" data-open={switchOpen}>
              <div className="train-phase-status" aria-live="polite">
                <span className="train-phase-tag">
                  {isReady ? '待发车' : isDone ? '已回库' : `第 ${lap} 圈`}
                </span>
                <strong>{statusTitle}</strong>
                <p>{statusDetail}</p>
              </div>
              {isReady && (
                <button type="button" className="train-action" ref={startButton} onClick={() => dispatch({ type: 'start' })}>
                  <Play size={22} fill="currentColor" aria-hidden="true" /> 发车
                </button>
              )}
              {!isReady && !isDone && phase !== 'depot' && (
                <div className="train-switch">
                  <button
                    type="button"
                    className="train-action train-switch-button"
                    data-open={switchOpen}
                    aria-label={switchOpen ? `切换道岔，当前前往${CARGO[lane].station}` : '本圈道岔已锁定'}
                    ref={switchButton}
                    onClick={switchTrack}
                  >
                    {switchOpen ? <GitFork size={22} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
                    {switchOpen ? '切换道岔' : lateLap === lap ? '本圈不能换站' : '道岔已锁定'}
                    {switchOpen && <span className="train-countdown" aria-hidden="true">{remainingSeconds}s</span>}
                  </button>
                  {switchOpen && (
                    <span className="train-timer" aria-hidden="true">
                      <span style={{ transform: `scaleX(${1 - progress})` }} />
                    </span>
                  )}
                </div>
              )}
              {(phase === 'depot' || isDone) && (
                <span className="train-depot-stamp"><Flag size={22} aria-hidden="true" /> {isDone ? '已回库' : '正在回库'}</span>
              )}
            </div>

            <ol className="train-steps" aria-label="一圈的执行步骤">
              {[
                { label: '到站', Icon: TrainFront },
                { label: '装货', Icon: Package },
                { label: '核对', Icon: Check },
                { label: nextStep, Icon: Repeat2 },
              ].map(({ label, Icon }, index) => (
                <li key={index} aria-current={step === index ? 'step' : undefined} data-done={step > index}>
                  <span className="train-step-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span>{label}</span>
                  {index < 3 && <ChevronRight className="train-step-arrow" size={15} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>

      <dialog className="train-help train-card" aria-labelledby="train-help-title" ref={helpDialog} onClose={closeHelp}>
        <div className="train-help-header">
          <h2 id="train-help-title">小火车操作提示</h2>
          <form method="dialog"><button type="submit" className="train-quiet-button" aria-label="关闭操作提示" autoFocus><X size={20} /></button></form>
        </div>
        <ol>
          <li><strong>出发前</strong> 选一张订单，再选回库规则。</li>
          <li><strong>过岔口前</strong> 看当前去哪个站，想换站就点「切换道岔」。订单三到五的换道时间逐渐缩短。</li>
          <li><strong>每一圈</strong> 到站最多装一箱，核对后按规则再跑或回库。</li>
          <li><strong>到库后</strong> 装齐的订单会记入教师端排行榜，每张订单只保留最佳圈数。</li>
        </ol>
        <form method="dialog"><button type="submit" className="train-action">明白了 <Check size={20} aria-hidden="true" /></button></form>
      </dialog>
    </div>
  );
}
