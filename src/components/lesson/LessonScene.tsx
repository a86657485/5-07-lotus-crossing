import React, { useEffect, useRef, useState } from 'react';
import type { CrossingCaseId, TraceStep } from '../../lesson/model';

type Props = {
  kind: 'crossing' | 'kettle' | 'traffic';
  step?: TraceStep;
  crossingCase?: CrossingCaseId;
  running?: boolean;
  title?: string;
  initialTemperature?: number;
  highlightBridge?: boolean;
};


function CoverStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: '100%', height: '100%', left: '0px', top: '0px' });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ratio = 16 / 9;
      let width = r.width, height = r.width / ratio;
      if (height < r.height) { height = r.height; width = height * ratio; }
      const overflowX = width - r.width;
      const overflowY = height - r.height;
      // Keep the right-side skybridge and pedestrian signal in view on taller frames.
      const left = overflowX <= 0 ? (r.width - width) / 2 : -overflowX * 0.65;
      const top = overflowY <= 0 ? (r.height - height) / 2 : -overflowY / 2;
      setBox({
        width: `${width}px`,
        height: `${height}px`,
        left: `${left}px`,
        top: `${top}px`,
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="scene-art">
    <div className="scene-art-inner" style={box}>{children}</div>
  </div>;
}

function Actor({ src, className, alt, focus, count }: { src: string; className: string; alt: string; focus?: boolean; count?: number }) {
  return (
    <div className={`scene-actor ${className} ${focus ? 'has-focus' : ''}`}>
      {focus && <span className="actor-focus-ring" aria-hidden="true" />}
      {focus && <span className="actor-focus-arrow" aria-hidden="true" />}
      {typeof count === 'number' && count > 0 && <span className="actor-count" aria-hidden="true">{count}</span>}
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
}

export default function LessonScene({ kind, step, crossingCase = 'red_then_green', running, title, initialTemperature = 80, highlightBridge = false }: Props) {
  if (kind === 'kettle') {
    const temp = step?.temperature ?? initialTemperature;
    return <div className={`lesson-scene kettle-scene ${step?.heating ? 'heating' : ''} ${running ? 'is-running' : ''}`}>
      <CoverStage>
        <img className="scene-backdrop" src="/lesson/scenes/scene_s2_kettle.png" alt="莲花山南门旁休息点的热水壶" />
        <div className="temperature-cover" aria-hidden="true">
          <div className="temperature-readout">{temp}<small>℃</small></div>
        </div>
        <div className={`kettle-steam-layer ${step?.heating ? 'heating' : ''}`} aria-hidden="true">
          <i /><i /><i />
        </div>
        <Actor src="/lesson/chars/alian_stand.png" className="alian kettle-alian" alt="阿莲在壶桌旁指导" />
        <Actor src="/lesson/chars/player_stand.png" className="player kettle-player" alt="小交警在观察热水壶" focus={!!running} />
      </CoverStage>
      <div className="scene-location">休息点 · 热水壶</div>
      <div className="scene-caption">{step?.label || '先读取水温，再决定是否加热。'}</div>
      <span className="simulation-label">温度变化为教学仿真</span>
    </div>;
  }

  const light = step?.light || (kind === 'crossing' && crossingCase === 'green_at_start' ? 'green' : 'red');
  const person = step?.person || 'waiting';
  const crossing = person === 'crossing';
  const onBridge = person === 'on_bridge';
  const counting = person === 'counting';
  const waiting = step?.carsWaiting ?? 12;
  const playerSrc = person === 'waiting' || person === 'stopped' || counting ? '/lesson/chars/player_stand.png' : '/lesson/chars/player_walk.png';
  const bridgeStage = onBridge ? (step?.position === 2 ? 'stage-2' : step?.position === 3 ? 'stage-3' : 'stage-1') : '';
  const showBridgeGlow = highlightBridge || onBridge;

  if (kind === 'traffic') {
    return <div className={`lesson-scene traffic-scene ${running ? 'is-running' : ''} ${light === 'green' ? 'green-light' : ''}`}>
      <CoverStage>
        <img className="scene-backdrop" src="/lesson/scenes/scene_s3_booth.png" alt="调度亭，窗外是带天桥的路口" />
        <div className="window-traffic" aria-hidden="true">
          <div className="traffic-queue">{Array.from({ length: waiting }, (_, i) => <div key={i} className="queue-car" style={{ left: `${4 + (i % 6) * 15}%`, top: `${18 + Math.floor(i / 6) * 32}%` }}><svg viewBox="0 0 100 58" aria-hidden="true"><path d="M7 32L18 18Q23 9 40 9H63Q75 10 84 27L94 31L95 46H7Z" fill={i % 3 === 0 ? '#f5c766' : '#70bbed'} stroke="#365575" strokeWidth="2"/><path d="M26 18H42V29H20ZM48 18H63Q70 20 75 29H48Z" fill="#dbf1ff"/><circle cx="27" cy="45" r="8" fill="#364762"/><circle cx="77" cy="45" r="8" fill="#364762"/></svg></div>)}</div>
        </div>
        <div className={`vehicle-signal ${light}`}><i /><i /><i /></div>
        <div className="queue-counter">等候 <b>{waiting}</b> 辆</div>
        <Actor src="/lesson/chars/alian_stand.png" className="alian traffic-alian" alt="阿莲把调度台交给小交警" />
        <Actor src="/lesson/chars/player_stand.png" className="player traffic-player" alt="小交警在控制台前" focus={!!running} />
        <Actor src="/lesson/chars/leader_stand.png" className="leader traffic-leader" alt="领队在窗边" />
      </CoverStage>
      <div className="scene-location">莲花山 · 调度台</div>
      <div className="scene-caption">{step?.label || title || '先运行原方案，看看这一侧的排队。'}</div>
      <span className="simulation-label">教学仿真 · 灯按模拟时间变化</span>
    </div>;
  }

  return <div className={`lesson-scene crossing-scene ${running ? 'is-running' : ''} ${light === 'green' ? 'green-light' : ''} ${showBridgeGlow ? 'bridge-lit' : ''}`}>
    <CoverStage>
      <img className="scene-backdrop" src="/lesson/scenes/scene_s1_crossing_bridge.png" alt="莲花山南门路口、斑马线与右侧人行天桥" />
      <div className="bridge-highlight" aria-hidden="true" />
      <div className="signal-cover" aria-hidden="true" />
      <div className="pedestrian-signal" data-light={light} aria-label={light === 'green' ? '行人绿灯亮着' : '行人红灯亮着'}>
        <div className={light === 'red' ? 'red on' : 'red'}><span>停</span></div>
        <div className={light === 'green' ? 'green on' : 'green'}><span>行</span></div>
      </div>
      <Actor src="/lesson/chars/alian_stand.png" className="alian crossing-alian" alt="阿莲在路边指导" />
      <Actor
        src={playerSrc}
        className={`player crossing-player is-${person === 'on_bridge' ? 'on-bridge' : person}${crossing && step?.nodeId === 'end' ? ' has-arrived' : ''} ${bridgeStage}`}
        alt="橙马甲小交警"
        focus={running || onBridge || crossing || counting}
        count={counting ? (step?.observations || 0) : undefined}
      />
    </CoverStage>
    <div className="scene-location">莲花山 · 行人引导台</div>
    <div className="scene-caption">{step?.label || title || '把流程说清楚，再让行人试一试。'}</div>
    <span className="simulation-label">教学仿真 · 灯按模拟时间变化</span>
  </div>;
}
