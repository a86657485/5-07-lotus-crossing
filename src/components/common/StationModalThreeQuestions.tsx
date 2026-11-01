import React from 'react';

interface StationThreeQuestionsProps {
  stationNumber: number;
  stationTitle: string;
  accident: string;      // 出事
  myRole: string;        // 与我关系
  verification: string;  // 能验证什么
  onConfirm: () => void;
  onClose?: () => void;
}

export const StationModalThreeQuestions: React.FC<StationThreeQuestionsProps> = ({
  stationNumber,
  stationTitle,
  accident,
  myRole,
  verification,
  onConfirm,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700"
            aria-label="关闭"
          >
            ×
          </button>
        )}

        <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-3">
          <span className="bg-amber-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-sm">
            第 {stationNumber} 站
          </span>
          <h2 className="text-xl font-bold text-amber-400">{stationTitle}</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-red-500/30 flex gap-3 items-start">
            <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5">
              出事
            </span>
            <p className="text-sm text-slate-200 leading-snug">{accident}</p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-amber-500/30 flex gap-3 items-start">
            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5">
              我来做
            </span>
            <p className="text-sm text-slate-200 leading-snug">{myRole}</p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-emerald-500/30 flex gap-3 items-start">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5">
              验证
            </span>
            <p className="text-sm text-slate-200 leading-snug">{verification}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="w-full h-14 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 text-base font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
        >
          <span>进入探究工作台</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
