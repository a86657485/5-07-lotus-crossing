import React, { useState } from 'react';
import { StationModalThreeQuestions } from '../common/StationModalThreeQuestions';
import { ScaffoldDialog } from '../common/ScaffoldDialog';
import { FlowTerminal, FlowProcess, FlowDecision, FlowReturnEdge } from '../common/FlowchartPrimitives';

interface Station2LoopAnalysisViewProps {
  onComplete: () => void;
  onBackToMap: () => void;
}

export const Station2LoopAnalysisView: React.FC<Station2LoopAnalysisViewProps> = ({
  onComplete,
  onBackToMap,
}) => {
  const [showThreeQuestions, setShowThreeQuestions] = useState(true);
  const [showPreStudyCard, setShowPreStudyCard] = useState(false);
  const [subTab, setSubTab] = useState<'A' | 'B' | 'C'>('A');

  // S2-A state
  const [s2aCondition, setS2aCondition] = useState<string | null>(null);
  const [s2aAction, setS2aAction] = useState<string | null>(null);
  const [s2aBackEdge, setS2aBackEdge] = useState<string | null>(null);
  const [s2aLocked, setS2aLocked] = useState(false);
  const [s2aSimStep, setS2aSimStep] = useState<number>(0);

  // S2-B state
  const [s2bChoice, setS2bChoice] = useState<'loop' | 'branch' | null>(null);
  const [s2bLocked, setS2bLocked] = useState(false);

  // S2-C state
  const [s2cCondition, setS2cCondition] = useState<string | null>(null);
  const [s2cAction, setS2cAction] = useState<string | null>(null);
  const [s2cTiming, setS2cTiming] = useState<'ask_first' | 'do_first' | null>(null);
  const [s2cLocked, setS2cLocked] = useState(false);

  // Scaffold & error handling
  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3 | null>(null);
  const [scaffoldPrompt, setScaffoldPrompt] = useState('');
  const [subErrorCount, setSubErrorCount] = useState(0);

  // Check overall completion
  const isAllDone = s2aLocked && s2bLocked && s2cLocked;

  // Handle S2-A Lock
  const handleLockS2A = () => {
    const isCorrect =
      s2aCondition === '绿灯未亮？' &&
      s2aAction === '原地观察红绿灯' &&
      s2aBackEdge === '接回「原地观察」';

    if (isCorrect) {
      setS2aLocked(true);
      // Run short simulation animation: 1: checking, 2: repeating, 3: green light, 4: exit
      setS2aSimStep(1);
      setTimeout(() => setS2aSimStep(2), 700);
      setTimeout(() => setS2aSimStep(3), 1400);
      setTimeout(() => setS2aSimStep(4), 2100);
    } else {
      const err = subErrorCount + 1;
      setSubErrorCount(err);
      if (s2aCondition === '原地观察') {
        setScaffoldPrompt('菱形框里必须是能回答「是或否」的问句，不能放动作哦！');
      } else if (s2aBackEdge !== '接回「原地观察」') {
        setScaffoldPrompt('回边箭头是要把控制接回还在重复做的哪一步？');
      } else {
        setScaffoldPrompt('仔细检查：菱形问是否未亮，矩形反复原地观察，回边指回原地观察。');
      }
      setScaffoldLevel(err >= 3 ? 3 : err === 2 ? 2 : 1);
    }
  };

  // Handle S2-B Lock
  const handleLockS2B = () => {
    if (s2bChoice === 'loop') {
      setS2bLocked(true);
    } else {
      const err = subErrorCount + 1;
      setSubErrorCount(err);
      setScaffoldPrompt('两张图都有菱形！右图是走天桥或等灯，两条路各走一次；左图有回边箭头指回来，在问还要不要再等。');
      setScaffoldLevel(err >= 3 ? 3 : err === 2 ? 2 : 1);
    }
  };

  // Handle S2-C Lock
  const handleLockS2C = () => {
    const isCorrect =
      s2cCondition === '水温还低于设定？' &&
      s2cAction === '继续加热' &&
      s2cTiming === 'ask_first';

    if (isCorrect) {
      setS2cLocked(true);
    } else {
      const err = subErrorCount + 1;
      setSubErrorCount(err);
      if (s2cTiming === 'do_first') {
        setScaffoldPrompt('图上是先读取水温比较是否低于设定，不够才加热，所以是「先问再做」！');
      } else {
        setScaffoldPrompt('条件是判断水温，反复步骤是继续加热，时机是先问再做。');
      }
      setScaffoldLevel(err >= 3 ? 3 : err === 2 ? 2 : 1);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none">
      {/* 进站三问 */}
      {showThreeQuestions && (
        <StationModalThreeQuestions
          stationNumber={2}
          stationTitle="信号循环拆解台"
          accident="信号屏循环图说不清「再等」停在哪，大家分不清选路还是循环。"
          myRole="帮阿莲拆解信号灯与保温壶，画对带回边的图。"
          verification="回边画对、对比分清、保温壶先问时机找对。"
          onConfirm={() => {
            setShowThreeQuestions(false);
            setShowPreStudyCard(true); // Open pre-study card directly
          }}
          onClose={onBackToMap}
        />
      )}

      {/* 先学卡 (Pre-study card, dismissible with X anytime) */}
      {showPreStudyCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowPreStudyCard(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700"
              aria-label="关闭先学卡"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-xs">
                先学卡 (30秒微讲)
              </span>
              <h3 className="font-bold text-base text-amber-300">
                怎么把「反复等」画成图？
              </h3>
            </div>

            {/* Loop Diagram mini schematic */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-700 mb-4 flex flex-col items-center">
              <div className="flex items-center gap-2 text-xs mb-3">
                <FlowTerminal label="到达路口" />
                <span>➜</span>
                <div className="px-2.5 py-1 bg-amber-500/20 border border-amber-500 text-amber-300 rounded text-xs font-bold">
                  菱形条件：绿灯未亮？
                </div>
              </div>

              <div className="flex items-center justify-between w-full max-w-xs text-xs px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-amber-400 font-semibold">【是】➜ 原地观察 ➜ ↩ 回边指回菱形</span>
              </div>
              <div className="w-full max-w-xs text-xs px-2 py-1 bg-slate-900 rounded-lg border border-slate-800 mt-1">
                <span className="text-emerald-400 font-semibold">【否】(绿灯亮了) ➜ 走出循环过马路</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 mb-5">
              <p>① 菱形框在问「还要不要再做」（能回答是或否）。</p>
              <p>② 回边箭头＝条件成立，就绕回来再做一遍。</p>
              <p>③ 重复的次数可以事先不知道，灯亮了就立刻停下！</p>
            </div>

            <button
              type="button"
              onClick={() => setShowPreStudyCard(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition"
            >
              开始拆解工作台 →
            </button>
          </div>
        </div>
      )}

      {/* Scaffold */}
      {scaffoldLevel && (
        <ScaffoldDialog
          level={scaffoldLevel}
          prompt={scaffoldPrompt}
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
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-sm font-bold text-amber-400">
              第 2 站：信号循环拆解台（核心探究）
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreStudyCard(true)}
            className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-500/10 transition"
          >
            📖 查看先学卡
          </button>
        </div>
      </div>

      {/* Sub tabs: S2-A, S2-B, S2-C */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { id: 'A', label: 'S2-A 改写循环图', done: s2aLocked },
          { id: 'B', label: 'S2-B 循环 vs 分支', done: s2bLocked },
          { id: 'C', label: 'S2-C 保温壶认读', done: s2cLocked },
        ].map(tab => {
          const isCurrent = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as 'A' | 'B' | 'C')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                isCurrent
                  ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              {tab.done && <span className="text-emerald-900 font-extrabold">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Task Prompt bar */}
      <div className="bg-slate-800/95 border-l-4 border-amber-500 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 mb-4 shadow flex items-center justify-between">
        <span>
          {subTab === 'A' && '任务：把「观察并等待」改成带回箭头的图，填入菱形条件、反复步骤与回边'}
          {subTab === 'B' && '任务：两张图都有菱形。点选哪张在问「还要不要再做一遍」？'}
          {subTab === 'C' && '任务：休息点保温壶图——标出循环条件、反复步骤以及是「先问再做」还是「先做再问」'}
        </span>
        <span className="text-[11px] text-amber-400 font-normal">
          {subTab === 'A' ? (s2aLocked ? 'A 已锁定达成' : '待锁定') : ''}
          {subTab === 'B' ? (s2bLocked ? 'B 已达成' : '待点选') : ''}
          {subTab === 'C' ? (s2cLocked ? 'C 已达成' : '待点选') : ''}
        </span>
      </div>

      {/* SUB-TASK S2-A */}
      {subTab === 'A' && (
        <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
          {/* Flowchart assembly canvas */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-700/80">
              <FlowTerminal label="到达路口" />
              <span className="text-slate-400">➜</span>

              {/* Slot 1: Decision Diamond */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-400 font-bold mb-1">【菱形条件】</span>
                <div
                  className={`w-40 h-20 border-2 rounded-xl flex items-center justify-center text-center p-2 text-xs font-bold transition ${
                    s2aCondition
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-dashed border-amber-500/60 bg-amber-500/5 text-amber-300'
                  }`}
                >
                  {s2aCondition || '点下方选条件'}
                </div>
              </div>

              <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-amber-400 font-bold">是 / 未亮</span>
                <span className="text-amber-400">➜</span>
              </div>

              {/* Slot 2: Repeat Process Rectangle */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-400 font-bold mb-1">【反复步骤】</span>
                <div
                  className={`w-36 h-20 border-2 rounded-xl flex items-center justify-center text-center p-2 text-xs font-bold transition ${
                    s2aAction
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-dashed border-amber-500/60 bg-amber-500/5 text-amber-300'
                  }`}
                >
                  {s2aAction || '点下方选反复步骤'}
                </div>
              </div>

              {/* Slot 3: Return Edge connection */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-400 font-bold mb-1">【回边箭头指回】</span>
                <div
                  className={`w-36 h-20 border-2 rounded-xl flex items-center justify-center text-center p-2 text-xs font-bold transition ${
                    s2aBackEdge
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-dashed border-amber-500/60 bg-amber-500/5 text-amber-300'
                  }`}
                >
                  {s2aBackEdge || '点下方选回边'}
                </div>
              </div>

              <span className="text-slate-400">➜</span>
              <FlowProcess label="过马路" />
              <span className="text-slate-400">➜</span>
              <FlowTerminal label="到达对面" />
            </div>

            {/* Simulation feedback if locked */}
            {s2aLocked && (
              <div className="p-3 bg-slate-900 border border-emerald-500/60 rounded-xl text-center text-xs animate-in fade-in">
                <div className="font-bold text-emerald-400 mb-1">
                  短回放实测：
                  {s2aSimStep === 1 && ' 正在检查条件「绿灯未亮？」...'}
                  {s2aSimStep === 2 && ' 条件成立 ➜ 执行「原地观察红绿灯」，并沿回边绕回！'}
                  {s2aSimStep === 3 && ' 绿灯亮起！条件不成立 ➜ 走出循环！'}
                  {s2aSimStep === 4 && ' 顺利走上斑马线，安全过马路！'}
                </div>
                <div className="text-slate-400 text-[11px]">
                  循环改写成功，回边正确接回反复动作。请切换到 S2-B 进行对比！
                </div>
              </div>
            )}
          </div>

          {/* Cards selection */}
          {!s2aLocked && (
            <div className="space-y-3 mt-4 pt-3 border-t border-slate-700">
              <div>
                <span className="text-xs text-slate-400 font-semibold mb-1 block">
                  1. 选择菱形条件卡（只能放能答是/否的条件）：
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['绿灯未亮？', '现在该过马路吗？', '原地观察'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setS2aCondition(c)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border transition ${
                        s2aCondition === c
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-semibold mb-1 block">
                  2. 选择反复做的矩形步骤：
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['原地观察红绿灯', '过马路', '到达对面'].map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setS2aAction(a)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border transition ${
                        s2aAction === a
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-semibold mb-1 block">
                  3. 选择回边箭头连接位置：
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['接回「原地观察」', '接到「过马路」', '接到「到达对面」'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setS2aBackEdge(b)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border transition ${
                        s2aBackEdge === b
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!s2aCondition || !s2aAction || !s2aBackEdge}
                onClick={handleLockS2A}
                className={`w-full py-3 rounded-xl font-bold text-sm transition mt-2 ${
                  s2aCondition && s2aAction && s2aBackEdge
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                锁定改写图并运行回放 →
              </button>
            </div>
          )}

          {s2aLocked && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSubTab('B')}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                前往 S2-B 循环 vs 分支对比 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TASK S2-B */}
      {subTab === 'B' && (
        <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-bold text-amber-300 mb-1">
                两张图都有菱形条件框。哪一张在表达「还要不要再做一遍」？
              </h3>
              <p className="text-xs text-slate-400">
                请仔细对比两张流程图的出口线条走向：
              </p>
            </div>

            {/* Side-by-side equal weight comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Loop diagram */}
              <div
                onClick={() => !s2bLocked && setS2bChoice('loop')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  s2bChoice === 'loop'
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg'
                    : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                  <span className="font-bold text-xs text-amber-400">图甲：带回边的等灯流程</span>
                  <span className="text-[10px] text-slate-400">点击点选</span>
                </div>
                <div className="p-3 bg-slate-950/70 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">到达路口 ➜</span>
                    <span className="bg-sky-950 text-sky-300 border border-sky-600 px-2 py-0.5 rounded text-[11px] font-bold">
                      绿灯未亮？
                    </span>
                  </div>
                  <div className="p-2 bg-amber-950/30 border border-amber-600/40 rounded text-amber-300 text-[11px]">
                    【是】➜ 原地观察 ➜ ↩ <strong className="text-amber-200">回边绕回重新判断</strong>
                  </div>
                  <div className="text-emerald-400 text-[11px]">
                    【否】➜ 走出循环去过马路
                  </div>
                </div>
              </div>

              {/* Right: Branch diagram */}
              <div
                onClick={() => !s2bLocked && setS2bChoice('branch')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  s2bChoice === 'branch'
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg'
                    : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                  <span className="font-bold text-xs text-sky-400">图乙：天桥分支流程</span>
                  <span className="text-[10px] text-slate-400">点击点选</span>
                </div>
                <div className="p-3 bg-slate-950/70 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">到达路口 ➜</span>
                    <span className="bg-sky-950 text-sky-300 border border-sky-600 px-2 py-0.5 rounded text-[11px] font-bold">
                      有天桥吗？
                    </span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded text-slate-300 text-[11px]">
                    【是】➜ 走天桥过去（各走一次，不绕回）
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded text-slate-300 text-[11px]">
                    【否】➜ 等绿灯过街（各走一次，不绕回）
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!s2bLocked ? (
            <button
              type="button"
              disabled={!s2bChoice}
              onClick={handleLockS2B}
              className={`w-full py-3 rounded-xl font-bold text-sm transition mt-4 ${
                s2bChoice
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              提交对比选择 →
            </button>
          ) : (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-emerald-400 text-xs mb-0.5">
                  ✓ 识别准确！
                </h4>
                <p className="text-slate-300 text-xs">
                  选路通常各走一次；循环则是「还要不要再做一遍」的回边反复。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('C')}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
              >
                前往 S2-C 保温壶认读 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TASK S2-C */}
      {subTab === 'C' && (
        <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-bold text-amber-300 mb-1">
                路口志愿者休息点：不锈钢保温壶流程认读
              </h3>
              <p className="text-xs text-slate-400">
                保温壶自动烧水也是身边的算法，标出循环条件、反复动作及判断时机：
              </p>
            </div>

            {/* Kettle Diagram visualization */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-700 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🫖</span>
                <span className="text-xs font-bold text-slate-200">智能保温壶加热控制图</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <FlowTerminal label="按下保温" />
                <span>➜</span>
                <div className="p-2 rounded-xl border border-sky-500 bg-sky-950/80 text-sky-300 font-bold">
                  问：{s2cCondition || '【待点选循环条件】'}
                </div>
                <span>➜ 是 ➜</span>
                <div className="p-2 rounded-xl border border-amber-500 bg-amber-950/80 text-amber-300 font-bold">
                  做：{s2cAction || '【待点选反复动作】'}
                </div>
                <span>➜ ↩ 回边重新测量水温</span>
              </div>
            </div>

            {/* Selection tags */}
            {!s2cLocked && (
              <div className="space-y-3 pt-2">
                <div>
                  <span className="text-xs text-slate-400 font-semibold mb-1 block">
                    1. 循环条件（在问什么）：
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {['水温还低于设定？', '继续加热'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setS2cCondition(c)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition ${
                          s2cCondition === c
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-semibold mb-1 block">
                    2. 反复步骤（反复做什么）：
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {['继续加热', '打开壶盖'].map(a => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setS2cAction(a)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition ${
                          s2cAction === a
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-semibold mb-1 block">
                    3. 判断时机（先问还是先做）：
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ask_first', label: '先问再做（先测水温再决定是否加热）' },
                      { id: 'do_first', label: '先做再问（先加热一次再问够不够）' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setS2cTiming(t.id as any)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border transition text-left ${
                          s2cTiming === t.id
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!s2cCondition || !s2cAction || !s2cTiming}
                  onClick={handleLockS2C}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition mt-2 ${
                    s2cCondition && s2cAction && s2cTiming
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  锁定保温壶认读 →
                </button>
              </div>
            )}
          </div>

          {/* S2 Whole Complete Banner */}
          {isAllDone && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 text-center animate-in zoom-in-95">
              <div className="text-4xl mb-2">🎉 ↩️</div>
              <h3 className="font-bold text-base text-emerald-400 mb-1">
                第 2 站全部拆解完成！收下「回边箭头」碎片
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto mb-4">
                阿莲说：「回边画明白了，也分清了『再等』与『选路』！现在前往第 3 站调度台，解决路口的信号灯时长拥堵难题！」
              </p>
              <button
                type="button"
                onClick={onComplete}
                className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition"
              >
                收下回边箭头，前往第 3 站 →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
