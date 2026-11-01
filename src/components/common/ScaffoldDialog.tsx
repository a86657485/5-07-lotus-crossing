import React from 'react';

interface ScaffoldDialogProps {
  level: 1 | 2 | 3;
  prompt: string;
  onClose: () => void;
  subHint?: string;
}

export const ScaffoldDialog: React.FC<ScaffoldDialogProps> = ({
  level,
  prompt,
  onClose,
  subHint,
}) => {
  const titles = {
    1: '探究小提示（第 1 级：仔细观察）',
    2: '探究思路引导（第 2 级：厘清逻辑）',
    3: '探究结构示范（第 3 级：同构示意）',
  };

  const badgeColors = {
    1: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    2: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    3: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800"
          aria-label="关闭提示"
        >
          ×
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColors[level]}`}>
            提示 Lv.{level}
          </span>
          <h3 className="font-bold text-amber-400 text-base">{titles[level]}</h3>
        </div>

        <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 mb-5 text-sm leading-relaxed text-slate-200">
          <p className="font-medium text-amber-200 mb-2">{prompt}</p>
          {subHint && (
            <p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">
              {subHint}
            </p>
          )}

          {level === 3 && (
            <div className="mt-3 p-3 bg-slate-950/60 rounded-lg border border-slate-700 text-xs text-slate-300">
              <div className="font-semibold text-amber-400 mb-1">【结构同构参考】</div>
              <p>条件框（菱形，判断是/否） ➜ 反复做（矩形） ➜ 回边箭头接回反复动作！</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow"
        >
          我明白了，继续尝试
        </button>
      </div>
    </div>
  );
};
