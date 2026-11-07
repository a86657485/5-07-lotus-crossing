import React from 'react';
import type { CrossingCaseId, TraceStep } from '../../lesson/model';

type Props = { kind: 'crossing' | 'kettle' | 'traffic'; step?: TraceStep; crossingCase?: CrossingCaseId; running?: boolean; title?: string; initialTemperature?: number };

function Person() {
  return <svg viewBox="0 0 90 150" aria-hidden="true"><ellipse cx="45" cy="141" rx="30" ry="8" fill="#234a68" opacity=".2"/><path d="M29 104L26 134Q34 140 42 134L45 111L49 134Q58 140 66 134L61 104" fill="#31486c"/><path d="M27 76Q14 79 16 106L29 108L33 90M61 76Q76 80 74 106L61 108L58 90" fill="#ffe1b1" stroke="#73594b" strokeWidth="2"/><path d="M28 72Q43 65 62 72L64 112Q45 119 27 112Z" fill="#f3912c" stroke="#9b5c2b" strokeWidth="2"/><path d="M44 72V115M29 94H62" stroke="#fff3c5" strokeWidth="6"/><ellipse cx="45" cy="45" rx="28" ry="30" fill="#ffdaad" stroke="#785d50" strokeWidth="2"/><path d="M18 46Q7 14 33 10Q62-4 76 24L71 47L64 29L53 32L46 20L34 34L24 29Z" fill="#5d463c" stroke="#463d3b" strokeWidth="3"/><circle cx="35" cy="46" r="3" fill="#493e41"/><circle cx="56" cy="46" r="3" fill="#493e41"/><path d="M39 59Q45 64 51 59" fill="none" stroke="#c07763" strokeWidth="2"/><circle cx="27" cy="55" r="5" fill="#edaa91" opacity=".7"/><circle cx="64" cy="55" r="5" fill="#edaa91" opacity=".7"/></svg>;
}

function Car({ color = '#70bbed' }: { color?: string }) {
  return <svg viewBox="0 0 100 58" aria-hidden="true"><ellipse cx="50" cy="50" rx="43" ry="6" fill="#254259" opacity=".18"/><path d="M7 32L18 18Q23 9 40 9H63Q75 10 84 27L94 31L95 46H7Z" fill={color} stroke="#365575" strokeWidth="2"/><path d="M26 18H42V29H20ZM48 18H63Q70 20 75 29H48Z" fill="#dbf1ff" stroke="#365575" strokeWidth="1.5"/><circle cx="27" cy="45" r="10" fill="#364762"/><circle cx="27" cy="45" r="5" fill="#bec8d8"/><circle cx="77" cy="45" r="10" fill="#364762"/><circle cx="77" cy="45" r="5" fill="#bec8d8"/><path d="M89 34H96V39H89" fill="#fff1b7"/></svg>;
}

export default function LessonScene({ kind, step, crossingCase = 'red_then_green', running, title, initialTemperature = 80 }: Props) {
  if (kind === 'kettle') {
    const temp = step?.temperature ?? initialTemperature;
    return <div className="lesson-scene kettle-scene">
      <div className="scene-location">休息点 · 热水壶</div>
      <div className={`kettle-illustration ${step?.heating ? 'heating' : ''}`}>
        <svg viewBox="0 0 400 350" aria-hidden="true"><defs><linearGradient id="kettleSteel" x1="0" x2="1"><stop stopColor="#7fb5ce"/><stop offset=".4" stopColor="#f3fbfc"/><stop offset="1" stopColor="#88b9cf"/></linearGradient></defs><ellipse cx="200" cy="310" rx="145" ry="18" fill="#89b3c1" opacity=".25"/><path d="M261 102Q349 100 334 202Q328 238 279 235" fill="none" stroke="#355a79" strokeWidth="24"/><path d="M130 105L84 82L101 170L125 186" fill="#b6dce8" stroke="#517c97" strokeWidth="4"/><path d="M136 86Q200 66 262 86L284 270Q200 302 116 270Z" fill="url(#kettleSteel)" stroke="#4b7894" strokeWidth="4"/><ellipse cx="199" cy="86" rx="64" ry="15" fill="#cce4ed" stroke="#4b7894" strokeWidth="4"/><path d="M182 71Q180 54 200 54Q219 54 217 71" fill="#3d607f"/><path d="M116 270Q200 302 284 270L289 294Q200 322 111 294Z" fill="#477490" stroke="#355a79" strokeWidth="3"/><rect x="171" y="199" width="58" height="55" rx="14" fill="#edf9fc" stroke="#8db8cb" strokeWidth="3"/><circle cx="200" cy="276" r="7" fill={step?.heating ? '#f68437' : '#a0c2cf'}/><path className="kettle-steam" d="M165 40Q150 22 169 7M198 37Q182 17 201 0M229 42Q213 24 232 9" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/></svg>
        <div className="temperature-readout">{temp}<small>℃</small></div>
      </div>
      <div className="scene-caption">{step?.label || '先读取水温，再决定是否加热。'}</div>
      <span className="simulation-label">温度变化为教学仿真</span>
    </div>;
  }
  const light = step?.light || (kind === 'crossing' && crossingCase === 'green_at_start' ? 'green' : 'red');
  const crossing = step?.person === 'crossing';
  const waiting = step?.carsWaiting ?? 12;
  return <div className={`lesson-scene crossing-scene ${running ? 'is-running' : ''} ${light === 'green' ? 'green-light' : ''}`}>
    <img className="crossing-backdrop" src="/lesson/crossing.png" alt="莲花山公园旁的路口与斑马线" />
    <div className="scene-location">莲花山 · {kind === 'traffic' ? '调度台' : '行人引导台'}</div>
    {kind === 'crossing' ? <>
      <div className={`scene-person ${crossing ? 'has-crossed' : ''}`}><Person /></div>
      <div className="road-car car-one"><Car /></div><div className="road-car car-two"><Car color="#f5c766" /></div>
      <div className="pedestrian-signal" data-light={light} aria-label={light === 'green' ? '行人绿灯亮着' : '行人红灯亮着'}><div className={light === 'red' ? 'red on' : 'red'}><span>停</span></div><div className={light === 'green' ? 'green on' : 'green'}><span>行</span></div><i /></div>
    </> : <>
      <div className="traffic-queue">{Array.from({ length: waiting }, (_, i) => <div key={i} className="queue-car" style={{ left: `${9 + (i % 6) * 10}%`, top: `${47 + Math.floor(i / 6) * 12}%` }}><Car color={i % 3 === 0 ? '#f5c766' : '#70bbed'} /></div>)}</div>
      <div className={`vehicle-signal ${light}`}><i /><i /><i /></div>
      <div className="queue-counter">等候 <b>{waiting}</b> 辆</div>
    </>}
    <div className="scene-caption">{step?.label || title || (kind === 'traffic' ? '先运行原方案，看看这一侧的排队。' : '把流程说清楚，再让行人试一试。')}</div>
    <span className="simulation-label">教学仿真 · 灯按模拟时间变化</span>
  </div>;
}
