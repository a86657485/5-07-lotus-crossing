import React, { useEffect, useReducer } from 'react';
import { initialTrafficRound, trafficRoundReducer } from '../../lesson/rewardTraffic';

interface RewardLoopGameProps {
  onBackToMap: () => void;
}

export const RewardLoopGame: React.FC<RewardLoopGameProps> = ({ onBackToMap }) => {
  const [round, dispatch] = useReducer(trafficRoundReducer, initialTrafficRound);
  const { phase: lightState, carQueue, pedQueue, carsCleared, pedsCleared, completedLoops } = round;
  const score = 100 + (carsCleared + pedsCleared) * 10;
  const lightName = { green: '绿灯', yellow: '黄灯', red: '红灯' }[lightState];

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: 'arrival', pedestrian: Math.random() > 0.5 });
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'tick' }), 1200);
    return () => clearInterval(interval);
  }, [lightState]);

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-3 mb-4 backdrop-blur shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition"
          >
            ← 返回路口
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎮</span>
            <h1 className="text-sm font-bold text-amber-400">
              达标奖励小游戏：信号灯循环总指挥
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
            本局指挥分：<strong className="text-amber-400">{score}</strong>
          </div>
          <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
            完成循环：<strong className="text-cyan-400">{completedLoops} 轮</strong>
          </div>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
        {/* Intersection Traffic simulator visual */}
        <div className="bg-slate-950 rounded-2xl border-2 border-slate-800 p-6 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Traffic Signal light pillar */}
          <div className="flex items-center gap-6 mb-6">
            <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-2.5 flex flex-col gap-2.5 shadow-2xl">
              {/* Red */}
              <div className={`w-8 h-8 rounded-full border-2 transition-all ${
                lightState === 'red'
                  ? 'bg-red-500 border-red-300 shadow-[0_0_15px_#EF4444]'
                  : 'bg-red-950/40 border-red-900 opacity-40'
              }`} />
              {/* Yellow */}
              <div className={`w-8 h-8 rounded-full border-2 transition-all ${
                lightState === 'yellow'
                  ? 'bg-amber-400 border-amber-200 shadow-[0_0_15px_#F59E0B]'
                  : 'bg-amber-950/40 border-amber-900 opacity-40'
              }`} />
              {/* Green */}
              <div className={`w-8 h-8 rounded-full border-2 transition-all ${
                lightState === 'green'
                  ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_15px_#22C55E]'
                  : 'bg-emerald-950/40 border-emerald-900 opacity-40'
              }`} />
            </div>

            {/* Loop status info */}
            <div className="text-xs space-y-1 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="font-bold text-amber-300">
                当前灯态：
                {lightState === 'green' && ' 绿灯（机动车放行）'}
                {lightState === 'yellow' && ' 黄灯（预备切换）'}
                {lightState === 'red' && ' 红灯（行人安全过街）'}
              </div>
              <div className="text-slate-400">
                循环规则：绿 ➜ 黄 ➜ 红 ➜ ↩ 回边绕回绿灯！
              </div>
            </div>
          </div>

          {/* Lane queues */}
          <div className="w-full max-w-md space-y-3">
            {/* Vehicle lane */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">南北机动车排队：</span>
                <div className="flex gap-1 text-base mt-1">
                  {Array.from({ length: carQueue }).map((_, i) => (
                    <span key={i} className="animate-pulse">🚗</span>
                  ))}
                  {carQueue === 0 && <span className="text-xs text-slate-500 italic">空闲无排队</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                已放行：<strong className="text-emerald-400 font-bold">{carsCleared} 辆</strong>
              </div>
            </div>

            {/* Pedestrian crosswalk */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">斑马线行人等待：</span>
                <div className="flex gap-1 text-base mt-1">
                  {Array.from({ length: pedQueue }).map((_, i) => (
                    <span key={i} className="animate-pulse">🚶🏻</span>
                  ))}
                  {pedQueue === 0 && <span className="text-xs text-slate-500 italic">无行人等待</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                已安全过街：<strong className="text-emerald-400 font-bold">{pedsCleared} 人</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Controller button */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'advance' })}
            className="w-full max-w-md py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-extrabold text-base shadow-xl transition flex items-center justify-center gap-2"
          >
            <span>🔄 推进循环下一步（当前：{lightName}）</span>
            <span>↩</span>
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            依次推进绿灯、黄灯、红灯，返回绿灯时完成一轮。
          </p>
          <p className="text-[11px] text-slate-400 text-center">教学仿真中，红灯阶段为行人放行。</p>
        </div>
      </div>
    </div>
  );
};
