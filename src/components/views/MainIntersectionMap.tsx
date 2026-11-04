import React from 'react';
import { FocusRing } from '../common/FocusRing';
import { RelicBadge } from '../common/RelicBadge';
import { RelicState, S3State, StationProgress, Student, TaskId } from '../../types';

interface MainIntersectionMapProps {
  student: Student;
  progress: StationProgress;
  relics: RelicState;
  s3State: S3State;
  onOpenStation: (taskId: TaskId) => void;
  onUseRelic: () => void;
  onReplayIntro: () => void;
  onResetStation: (taskId: TaskId) => void;
  onOpenRewardGame?: () => void;
  rewardUnlocked?: boolean;
}

export const MainIntersectionMap: React.FC<MainIntersectionMapProps> = ({
  student,
  progress,
  relics,
  s3State,
  onOpenStation,
  onUseRelic,
  onReplayIntro,
  onResetStation,
  onOpenRewardGame,
  rewardUnlocked = false,
}) => {
  // Determine current active station
  const s1Done = progress.s1_order;
  const s2Done = progress.s2_rewrite && progress.s2_vs_branch && progress.s2_kettle;
  const s3Done = progress.s3_timing;
  const allStationsDone = s1Done && s2Done && s3Done;

  const activeStation: TaskId = !s1Done
    ? 's1_order'
    : !s2Done
    ? 's2_rewrite'
    : !s3Done
    ? 's3_timing'
    : 'exam';

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none overflow-hidden font-sans">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-3 mb-4 backdrop-blur shadow-lg z-20 gap-3">
        {/* Student Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border-2 border-orange-400 flex items-center justify-center text-xl shrink-0 shadow-sm">
            🦺
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{student.name}</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                {student.classId} 班 · 临时小交警
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              当前任务：
              <span className="text-amber-400 font-semibold">
                {!s1Done
                  ? '第 1 站：行人过街引导台'
                  : !s2Done
                  ? '第 2 站：信号循环拆解台'
                  : !s3Done
                  ? '第 3 站：路口信号调度台'
                  : '综合考核检测门'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Relic Badge */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onReplayIntro}
            className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 transition"
          >
            重看委托 🎬
          </button>

          <button
            type="button"
            onClick={() => onResetStation(activeStation)}
            className="text-xs text-slate-400 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 transition"
          >
            重做本关
          </button>

          {/* Relic Quota & Fragments */}
          <RelicBadge
            relics={relics}
            onUseRelic={onUseRelic}
            currentTask={activeStation}
            s3State={s3State}
          />
        </div>
      </div>

      {/* Main Street Map Stage (Shenzhen Lianhuashan Daytime Intersection) */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-2xl">
        {/* City Sky & Hills Background */}
        <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-sky-400/20 via-sky-300/10 to-transparent pointer-events-none" />
        <div className="absolute top-4 left-6 flex items-center gap-2 opacity-40 pointer-events-none">
          <span className="text-2xl">⛰️</span>
          <span className="text-xs text-slate-400 font-bold">莲花山绿意远景 · 深圳日间晴空</span>
        </div>

        {/* Asphalt Road Canvas with Zebra Crossing */}
        <div className="absolute inset-x-8 bottom-6 top-24 bg-[#4B5563] rounded-3xl border-4 border-slate-600/80 shadow-2xl overflow-hidden flex flex-col justify-between">
          {/* Road Curb */}
          <div className="h-4 bg-[#9CA3AF] w-full border-b border-slate-700" />

          {/* Road Center with Zebra Stripes */}
          <div className="flex-1 relative flex items-center justify-center">
            {/* Horizontal Zebra Crosswalk */}
            <div className="w-full h-36 flex justify-around items-center px-4 bg-[#374151]">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-28 bg-[#F8FAFC] rounded-sm shadow-sm opacity-90"
                />
              ))}
            </div>

            {/* Road Traffic Lines */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b-2 border-dashed border-amber-400/60 pointer-events-none" />

            {/* Resting Table with Thermos (S2-C) */}
            <div className="absolute bottom-3 left-8 bg-slate-800/90 border border-slate-600 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg z-10">
              <span className="text-xl">🫖</span>
              <div className="text-[10px]">
                <div className="font-bold text-amber-300">休息点保温壶</div>
                <div className="text-slate-400">水温循环判断</div>
              </div>
            </div>
          </div>

          {/* Road Lower Curb */}
          <div className="h-4 bg-[#9CA3AF] w-full border-t border-slate-700" />
        </div>

        {/* 3 Interactive Station Kiosks + Exam Gate */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-4 my-auto pt-8">
          {/* Station 1: 行人过街引导台 */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => onOpenStation('s1_order')}
              className={`w-full max-w-[240px] p-5 rounded-2xl border-2 transition-all text-center backdrop-blur shadow-xl relative ${
                activeStation === 's1_order'
                  ? 'border-amber-400 bg-slate-900/95 ring-4 ring-amber-400/40 scale-105'
                  : s1Done
                  ? 'border-emerald-500/80 bg-slate-900/85'
                  : 'border-slate-700 bg-slate-900/60 opacity-60'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-2xl mx-auto mb-2 shadow">
                🚦
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-xs font-bold text-amber-400">第 1 站</span>
                <h3 className="font-extrabold text-sm text-white">行人过街引导台</h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                排顺过街步骤 · 揪出「一直等」
              </p>
              <div className="mt-3">
                {s1Done ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    ✓ 已完成 (已获哨)
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-950 bg-amber-500 px-3 py-1 rounded-full shadow">
                    进入探究 →
                  </span>
                )}
              </div>
            </button>

            {/* Q-version character at active station feet */}
            {activeStation === 's1_order' && (
              <div className="relative mt-2 flex flex-col items-center">
                <div className="text-2xl animate-bounce">👦🏻🦺</div>
                <FocusRing size="md" />
              </div>
            )}
          </div>

          {/* Station 2: 信号循环拆解台 */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              disabled={!s1Done}
              onClick={() => s1Done && onOpenStation('s2_rewrite')}
              className={`w-full max-w-[240px] p-5 rounded-2xl border-2 transition-all text-center backdrop-blur shadow-xl relative ${
                activeStation === 's2_rewrite'
                  ? 'border-amber-400 bg-slate-900/95 ring-4 ring-amber-400/40 scale-105'
                  : s2Done
                  ? 'border-emerald-500/80 bg-slate-900/85'
                  : s1Done
                  ? 'border-amber-500/50 bg-slate-900/80 hover:border-amber-400'
                  : 'border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center text-2xl mx-auto mb-2 shadow">
                ↩️
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-xs font-bold text-amber-400">第 2 站</span>
                <h3 className="font-extrabold text-sm text-white">信号循环拆解台</h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                改写回边循环图 · 保温壶认读
              </p>
              <div className="mt-3">
                {s2Done ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    ✓ 已完成 (已获回边)
                  </span>
                ) : s1Done ? (
                  <span className="text-[11px] font-bold text-slate-950 bg-amber-500 px-3 py-1 rounded-full shadow">
                    进入探究 →
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">🔒 需完成第 1 站</span>
                )}
              </div>
            </button>

            {activeStation === 's2_rewrite' && (
              <div className="relative mt-2 flex flex-col items-center">
                <div className="text-2xl animate-bounce">👦🏻🦺</div>
                <FocusRing size="md" />
              </div>
            )}
          </div>

          {/* Station 3: 路口信号调度台 */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              disabled={!s2Done}
              onClick={() => s2Done && onOpenStation('s3_timing')}
              className={`w-full max-w-[240px] p-5 rounded-2xl border-2 transition-all text-center backdrop-blur shadow-xl relative ${
                activeStation === 's3_timing'
                  ? 'border-amber-400 bg-slate-900/95 ring-4 ring-amber-400/40 scale-105'
                  : s3Done
                  ? 'border-emerald-500/80 bg-slate-900/85'
                  : s2Done
                  ? 'border-amber-500/50 bg-slate-900/80 hover:border-amber-400'
                  : 'border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-2xl mx-auto mb-2 shadow">
                ⚙️
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-xs font-bold text-amber-400">第 3 站</span>
                <h3 className="font-extrabold text-sm text-white">路口信号调度台</h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                实测拥堵反例 · 调度绿灯时长
              </p>
              <div className="mt-3">
                {s3Done ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    ✓ 已完成 (已获旋钮)
                  </span>
                ) : s2Done ? (
                  <span className="text-[11px] font-bold text-slate-950 bg-amber-500 px-3 py-1 rounded-full shadow">
                    进入探究 →
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">🔒 需完成第 2 站</span>
                )}
              </div>
            </button>

            {activeStation === 's3_timing' && (
              <div className="relative mt-2 flex flex-col items-center">
                <div className="text-2xl animate-bounce">👦🏻🦺</div>
                <FocusRing size="md" />
              </div>
            )}
          </div>

          {/* Exam Door / Final Gate */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              disabled={!allStationsDone}
              onClick={() => allStationsDone && onOpenStation('exam')}
              className={`w-full max-w-[240px] p-5 rounded-2xl border-2 transition-all text-center backdrop-blur shadow-xl relative ${
                activeStation === 'exam'
                  ? 'border-purple-400 bg-slate-900/95 ring-4 ring-purple-400/40 scale-105'
                  : progress.exam
                  ? 'border-emerald-500/80 bg-slate-900/85'
                  : allStationsDone
                  ? 'border-purple-500/60 bg-slate-900/80 hover:border-purple-400'
                  : 'border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center text-2xl mx-auto mb-2 shadow">
                📝
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-xs font-bold text-purple-400">开考</span>
                <h3 className="font-extrabold text-sm text-white">课堂分层考核</h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                基础 16 题 + 挑战 6 题
              </p>
              <div className="mt-3">
                {progress.exam ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    ✓ 考核已完成
                  </span>
                ) : allStationsDone ? (
                  <span className="text-[11px] font-bold text-white bg-purple-600 px-3 py-1 rounded-full shadow">
                    立即开考 →
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">🔒 三站完成后开考</span>
                )}
              </div>
            </button>

            {activeStation === 'exam' && (
              <div className="relative mt-2 flex flex-col items-center">
                <div className="text-2xl animate-bounce">👦🏻🦺</div>
                <FocusRing size="md" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Banner & Reward button if unlocked */}
        <div className="relative z-10 flex flex-wrap items-center justify-between border-t border-slate-700/80 pt-3 pb-1 px-3 mt-4 text-xs bg-slate-900/60 rounded-xl">
          <div className="flex items-center gap-2 text-slate-300">
            <span>深圳莲花山智慧路口 · 小交警值守点</span>
            <span>·</span>
            <span className="text-amber-400 font-semibold">
              {allStationsDone ? '三站探究齐备！已开启考核通道' : '请按顺序完成 S1 ➜ S2 ➜ S3'}
            </span>
          </div>

          {rewardUnlocked && onOpenRewardGame && (
            <button
              type="button"
              onClick={onOpenRewardGame}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>🎮 信号灯循环指挥小游戏</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
