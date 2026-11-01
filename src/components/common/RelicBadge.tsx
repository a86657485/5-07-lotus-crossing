import React, { useState } from 'react';
import { RelicState, TaskId, S3State } from '../../types';
import { getRelicHint } from '../../utils/evaluation';

interface RelicBadgeProps {
  relics: RelicState;
  onUseRelic: () => void;
  currentTask: TaskId;
  s3State?: S3State;
}

export const RelicBadge: React.FC<RelicBadgeProps> = ({
  relics,
  onUseRelic,
  currentTask,
  s3State,
}) => {
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintContent, setHintContent] = useState('');

  const handleOpenHelp = () => {
    if (relics.remaining <= 0) {
      setHintContent('本课法宝求助次数已用完，相信你能独立攻克难关！');
      setShowHintModal(true);
      return;
    }

    const hint = getRelicHint(currentTask, undefined, s3State);
    setHintContent(hint);
    onUseRelic();
    setShowHintModal(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-amber-500/50 rounded-full px-3 py-1.5 shadow-md">
        {/* Relic Fragment Icons */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700">
          {/* S1 Whistle */}
          <div
            title="S1 碎片：斑马线哨"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
              relics.unlockedRelics.whistle
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            哨
          </div>
          {/* S2 Arrow */}
          <div
            title="S2 碎片：回边箭头"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
              relics.unlockedRelics.arrow
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            ↩
          </div>
          {/* S3 Knob */}
          <div
            title="S3 碎片：时长旋钮"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
              relics.unlockedRelics.knob
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            ⚙
          </div>
        </div>

        {/* Relic Help Button */}
        <button
          type="button"
          onClick={handleOpenHelp}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm active:scale-95"
          aria-label="通关法宝求助"
        >
          <span>通关法宝</span>
          <span className="bg-slate-950/20 px-1.5 py-0.2 rounded-full text-[11px] font-bold">
            {relics.remaining}/{relics.quota}
          </span>
        </button>
      </div>

      {/* Relic Hint Dialog */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-slate-100">
            <button
              onClick={() => setShowHintModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition"
              aria-label="关闭法宝提示"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-bold shadow-lg">
                💡
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-400">通关法宝指路</h3>
                <p className="text-xs text-slate-400">指路不代做 · 不扣分 · 剩余 {relics.remaining} 次</p>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 mb-5 text-sm leading-relaxed text-slate-200">
              {hintContent}
            </div>

            <button
              type="button"
              onClick={() => setShowHintModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
};
