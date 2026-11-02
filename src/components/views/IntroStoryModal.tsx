import React, { useState } from 'react';

interface IntroStoryModalProps {
  onComplete: () => void;
  onSkip: () => void;
  isReplay?: boolean;
}

export const IntroStoryModal: React.FC<IntroStoryModalProps> = ({
  onComplete,
  onSkip,
  isReplay = false,
}) => {
  const [step, setStep] = useState(1);
  const [selectedTryStep, setSelectedTryStep] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-xl w-full p-6 text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Top header & Skip/Close */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-400 tracking-wider">
              莲花山智慧路口 · 任务简报 ({step}/4)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* If replay, allow instant X close from frame 1 */}
            {isReplay && (
              <button
                onClick={onComplete}
                className="text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700"
                aria-label="关闭回放"
              >
                ×
              </button>
            )}
            <button
              onClick={onSkip}
              className="text-xs text-slate-400 hover:text-amber-300 px-3 py-1 rounded-full border border-slate-700 hover:border-amber-400/40 transition"
            >
              跳过剧情 ⏭
            </button>
          </div>
        </div>

        {/* Story Scenes */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              {/* NPC Alian Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                👩🏻‍🦰
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">志愿者 阿莲</span>
                  <span className="bg-orange-500/20 text-orange-400 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    路口领队
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-snug">
                  「开放日人流量大，需要你当临时小交警助手！」
                </p>
                <p className="text-xs text-amber-300">
                  这是你的橙色反光志愿者马甲，快换上吧。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
              <div className="text-4xl mb-2 animate-bounce">🦺</div>
              <p className="text-xs text-slate-300">
                你穿上了小交警橙马甲，脚下亮起任务引导环。
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition"
            >
              接受委托，查看情况 →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <h3 className="text-sm font-bold text-amber-400 mb-1">
                微观察：行人口中的「等到绿灯」
              </h3>
              <p className="text-xs text-slate-300">
                行人说：「只要等到绿灯亮了就能过街。」
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                点选：哪一步其实在「一直反复等」？
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'arrive', label: '1. 到达路口' },
                  { id: 'wait', label: '2. 观察并等待绿灯' },
                  { id: 'cross', label: '3. 走上斑马线过街' },
                  { id: 'dest', label: '4. 到达对面' },
                ].map(opt => {
                  const isSelected = selectedTryStep === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedTryStep(opt.id)}
                      className={`p-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={!selectedTryStep}
              onClick={() => setStep(3)}
              className={`w-full h-12 rounded-xl font-bold text-sm transition ${
                selectedTryStep
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              下一步，回放系统 →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-rose-950/40 border border-rose-500/40 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>系统回放卡住了！</span>
              </div>
              <p className="text-sm text-slate-200">
                「观察等待」到底要等几次？什么时候才停？普通顺序图根本说不清！
              </p>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-center">
              <div className="text-3xl mb-1">🚦💥</div>
              <p className="text-xs text-amber-300 font-medium">
                路口信号调度屏也闪红报警：「参数错乱，通行拥堵」
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition"
            >
              看看今天的三个探究任务 →
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">
                小交警任务单已生成！
              </h3>
              <p className="text-xs text-slate-400">
                按顺序完成三个探究台，集齐法宝碎片解开路口难题：
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/90 border border-amber-500/40">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-xs font-semibold text-slate-200">
                  行人过街引导台：排顺步骤，揪出「一直等」
                </span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  信号循环拆解台：改写带回边的循环图
                </span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  路口信号调度台：实测故障，调度合理时长
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="w-full h-14 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-base rounded-xl shadow-lg transition"
            >
              领命出发！前往第 1 站 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
