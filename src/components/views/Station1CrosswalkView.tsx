import React, { useState } from 'react';
import { StationModalThreeQuestions } from '../common/StationModalThreeQuestions';
import { ScaffoldDialog } from '../common/ScaffoldDialog';

export interface Station1Evidence {
  stepsOrder: string[];
  waitingStepId: string | null;
}

interface Station1CrosswalkViewProps {
  onComplete: (evidence: Station1Evidence) => void;
  onBackToMap: () => void;
}

const ALL_CARDS = [
  { id: 'arrive', text: '到达路口' },
  { id: 'wait', text: '观察并等待绿灯' },
  { id: 'green', text: '绿灯亮起可过' },
  { id: 'cross', text: '过马路保持警觉' },
  { id: 'dest', text: '到达对面' },
  { id: 'dash', text: '先冲过马路', isDistractor: true },
];

const CORRECT_ORDER_IDS = ['arrive', 'wait', 'green', 'cross', 'dest'];

export const Station1CrosswalkView: React.FC<Station1CrosswalkViewProps> = ({
  onComplete,
  onBackToMap,
}) => {
  const [showThreeQuestions, setShowThreeQuestions] = useState(true);
  const [placedCardIds, setPlacedCardIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<'order' | 'spot_wait' | 'done'>('order');
  const [spottedWaitStepId, setSpottedWaitStepId] = useState<string | null>(null);
  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3 | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  // Undo button handler (⌫ 撤回上一步)
  const handleUndo = () => {
    if (placedCardIds.length > 0) {
      setPlacedCardIds(prev => prev.slice(0, prev.length - 1));
    }
  };

  // Reset station
  const handleReset = () => {
    setPlacedCardIds([]);
    setPhase('order');
    setSpottedWaitStepId(null);
    setScaffoldLevel(null);
  };

  // Click card to place
  const handleCardClick = (cardId: string) => {
    if (phase !== 'order') return;
    if (placedCardIds.includes(cardId)) return;
    if (placedCardIds.length >= 5) return;

    const nextPlaced = [...placedCardIds, cardId];
    setPlacedCardIds(nextPlaced);

    // If filled 5 slots, check
    if (nextPlaced.length === 5) {
      const isCorrect = nextPlaced.every((id, idx) => id === CORRECT_ORDER_IDS[idx]);
      if (isCorrect) {
        setPhase('spot_wait');
      } else {
        const nextErr = errorCount + 1;
        setErrorCount(nextErr);
        if (nextErr === 1) setScaffoldLevel(1);
        else if (nextErr === 2) setScaffoldLevel(2);
        else setScaffoldLevel(3);
      }
    }
  };

  // Spot wait step
  const handleSpotWait = (id: string) => {
    if (phase !== 'spot_wait') return;
    setSpottedWaitStepId(id);
    if (id === 'wait') {
      setPhase('done');
    } else {
      const nextErr = errorCount + 1;
      setErrorCount(nextErr);
      if (nextErr <= 1) setScaffoldLevel(1);
      else if (nextErr === 2) setScaffoldLevel(2);
      else setScaffoldLevel(3);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none">
      {/* 进站三问弹窗 */}
      {showThreeQuestions && (
        <StationModalThreeQuestions
          stationNumber={1}
          stationTitle="行人过街引导台"
          accident="过街队伍乱了序，行人站在路口不知先做哪步。"
          myRole="帮阿莲把过街步骤排对，理清正常顺序。"
          verification="顺序排对后，就能看出到底哪一步在「一直等」。"
          onConfirm={() => setShowThreeQuestions(false)}
          onClose={onBackToMap}
        />
      )}

      {/* Scaffold hint */}
      {scaffoldLevel && (
        <ScaffoldDialog
          level={scaffoldLevel}
          prompt={
            scaffoldLevel === 1
              ? '仔细想想平时过马路：先到达路口，接着原地做什么，然后看灯？'
              : scaffoldLevel === 2
              ? '「冲过马路」是危险干扰卡哦！正常顺序是到达、看灯等待、绿灯通行、到达对面。'
              : '标准过街步骤：到达路口 ➜ 观察并等待绿灯 ➜ 绿灯亮起可过 ➜ 过马路保持警觉 ➜ 到达对面。'
          }
          onClose={() => setScaffoldLevel(null)}
        />
      )}

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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-bold text-amber-400">
              第 1 站：行人过街引导台
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-amber-300 px-3 py-1 rounded-lg border border-slate-700 hover:border-slate-600 transition"
          >
            重做本关
          </button>
          <button
            onClick={handleUndo}
            disabled={placedCardIds.length === 0 || phase !== 'order'}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition ${
              placedCardIds.length > 0 && phase === 'order'
                ? 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10 cursor-pointer'
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <span>⌫ 撤回上一步</span>
          </button>
        </div>
      </div>

      {/* Task instruction bar (single line per spec) */}
      <div className="bg-slate-800/95 border-l-4 border-amber-500 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 mb-4 shadow flex items-center justify-between">
        <span>
          {phase === 'order' && '任务：将下方的过街步骤按正确先后顺序点进空槽中（共 5 步）'}
          {phase === 'spot_wait' && '任务：在排好的顺序图上，点击那一步「在一直反复等待」？'}
          {phase === 'done' && '恭喜！发现问题所在：顺序图说不清要等多少次，成功获取碎片！'}
        </span>
        <span className="text-[11px] text-amber-400 font-normal">
          {phase === 'order' ? `已排 ${placedCardIds.length}/5 步` : phase === 'spot_wait' ? '请点击卡片' : '已达成'}
        </span>
      </div>

      {/* Main interactive area */}
      <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
        {/* Sequence slots */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            过街流程图排列区
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map(idx => {
              const cardId = placedCardIds[idx];
              const card = ALL_CARDS.find(c => c.id === cardId);
              const isNextSlot = placedCardIds.length === idx && phase === 'order';
              const isWaitCard = cardId === 'wait';

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (phase === 'spot_wait' && cardId) {
                      handleSpotWait(cardId);
                    }
                  }}
                  className={`min-h-[96px] rounded-2xl p-3 flex flex-col justify-between border-2 transition-all relative ${
                    card
                      ? phase === 'spot_wait'
                        ? 'border-slate-600 bg-slate-700/80 cursor-pointer hover:border-amber-400 hover:scale-[1.02]'
                        : 'border-slate-600 bg-slate-800'
                      : isNextSlot
                      ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-400/30'
                      : 'border-dashed border-slate-700 bg-slate-900/40'
                  } ${phase === 'done' && isWaitCard ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400' : ''}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold">第 {idx + 1} 步</span>
                    {phase === 'spot_wait' && card && (
                      <span className="text-amber-400 text-[10px]">点选验证</span>
                    )}
                  </div>

                  {card ? (
                    <div className="text-center font-bold text-sm text-slate-100 py-1">
                      {card.text}
                    </div>
                  ) : (
                    <div className="text-center text-xs text-slate-500 italic py-2">
                      {isNextSlot ? '◀ 点击下方卡片放入' : '待放入'}
                    </div>
                  )}

                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    {card && <div className="h-full bg-amber-500 w-full" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Pool for ordering */}
        {phase === 'order' && (
          <div className="mt-6 pt-4 border-t border-slate-700/80">
            <div className="text-xs font-semibold text-slate-400 mb-3">
              待排步骤卡片（点击放入下一个空槽）：
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {ALL_CARDS.map(c => {
                const isPlaced = placedCardIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isPlaced}
                    onClick={() => handleCardClick(c.id)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                      isPlaced
                        ? 'opacity-30 border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-500 text-slate-200 hover:text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    {c.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Spot Wait phase prompt */}
        {phase === 'spot_wait' && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-center animate-in fade-in">
            <h4 className="font-bold text-amber-300 text-sm mb-1">
              步骤顺序排好啦！现在请仔细观察上面 5 步：
            </h4>
            <p className="text-xs text-slate-300">
              请直接在上面 5 张卡片中，点击那一步需要「反复看灯一直等」的卡片！
            </p>
          </div>
        )}

        {/* Done banner */}
        {phase === 'done' && (
          <div className="mt-6 p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 text-center animate-in zoom-in-95">
            <div className="text-4xl mb-2">🎉 🎺</div>
            <h3 className="font-bold text-base text-emerald-400 mb-1">
              第 1 站探究完成！收下「斑马线哨」碎片
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto mb-4">
              阿莲说：「顺序排顺了，但『观察等待』是一直重复做的事情，顺序图表达不清楚。快去第 2 站把它改写成带回箭头的图！」
            </p>
            <button
              type="button"
              onClick={() => onComplete({ stepsOrder: [...placedCardIds], waitingStepId: spottedWaitStepId })}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition"
            >
              收下法宝碎片，前往第 2 站 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
