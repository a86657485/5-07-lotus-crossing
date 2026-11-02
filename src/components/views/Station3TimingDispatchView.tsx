import React, { useState } from 'react';
import { StationModalThreeQuestions } from '../common/StationModalThreeQuestions';
import { ScaffoldDialog } from '../common/ScaffoldDialog';
import { S3State } from '../../types';

interface Station3TimingDispatchViewProps {
  onComplete: (detail: S3State) => void;
  onBackToMap: () => void;
}

export const Station3TimingDispatchView: React.FC<Station3TimingDispatchViewProps> = ({
  onComplete,
  onBackToMap,
}) => {
  const [showThreeQuestions, setShowThreeQuestions] = useState(true);
  const [showPreStudyCard, setShowPreStudyCard] = useState(false);

  // Phases: 'test_fault' -> 'congested' -> 'pick_rule' -> 'pick_reason' -> 'revalidate' -> 'cleared'
  const [phase, setPhase] = useState<
    'test_fault' | 'fault_running' | 'congested' | 'pick_rule' | 'pick_reason' | 'revalidate_running' | 'cleared'
  >('test_fault');

  const [s3State, setS3State] = useState<S3State>({
    faultObserved: false,
    scenario: 'car_heavy',
    strategy: '',
    reason: '',
    ruleChanged: false,
    revalidateOk: false,
  });

  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3 | null>(null);
  const [scaffoldPrompt, setScaffoldPrompt] = useState('');

  // 1. Run Fault
  const handleRunFault = () => {
    setPhase('fault_running');
    setTimeout(() => {
      setPhase('congested');
      setS3State(prev => ({ ...prev, faultObserved: true }));
    }, 2000);
  };

  // 2. Select Strategy
  const handleSelectStrategy = (strat: string) => {
    setS3State(prev => ({
      ...prev,
      strategy: strat,
      ruleChanged: true,
    }));
    setPhase('pick_reason');
  };

  // 3. Select Reason
  const handleSelectReason = (reason: string) => {
    if (reason === '让车更快疏散，小设置服务整条路口') {
      setS3State(prev => ({ ...prev, reason }));
      setPhase('revalidate_running');
      setTimeout(() => {
        setPhase('cleared');
        setS3State(prev => ({ ...prev, revalidateOk: true }));
      }, 2000);
    } else {
      setScaffoldPrompt('不能只背「智慧交通」这种空洞口号哦！调长绿灯是为了让积压的车辆更快疏散，小设置服务整个路口。');
      setScaffoldLevel(2);
    }
  };

  // Reset station
  const handleReset = () => {
    setPhase('test_fault');
    setS3State({
      faultObserved: false,
      scenario: 'car_heavy',
      strategy: '',
      reason: '',
      ruleChanged: false,
      revalidateOk: false,
    });
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none">
      {/* 进站三问 */}
      {showThreeQuestions && (
        <StationModalThreeQuestions
          stationNumber={3}
          stationTitle="路口信号调度台"
          accident="路口堵死成了长龙，原来是信号灯循环时长设错了。"
          myRole="帮阿莲观察故障反例，选出合理的绿灯时长策略与理由。"
          verification="换规则后再运行路口，看拥堵能不能彻底疏散缓解。"
          onConfirm={() => {
            setShowThreeQuestions(false);
            setShowPreStudyCard(true);
          }}
          onClose={onBackToMap}
        />
      )}

      {/* 先学卡 */}
      {showPreStudyCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowPreStudyCard(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800"
              aria-label="关闭先学卡"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-xs">
                调度先学卡 (20秒)
              </span>
              <h3 className="font-bold text-base text-amber-300">
                布置规则 vs 运行实测
              </h3>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-700 mb-4 text-xs text-slate-200 leading-relaxed">
              <p className="font-semibold text-amber-300 mb-1">
                「小设置调对了，整条路口更顺——这就是智慧交通。」
              </p>
              <p className="text-slate-400">
                信号灯每次循环持续多久不是随便填的。车多、人多或雨天，都需要合理的时长配置。我们先运行看看设错会有什么后果！
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPreStudyCard(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow transition text-sm"
            >
              进入调度大屏 →
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
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-sm font-bold text-amber-400">
              第 3 站：路口信号调度台
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
            onClick={() => setShowPreStudyCard(true)}
            className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1 rounded-lg border border-amber-500/40 hover:bg-amber-500/10 transition"
          >
            查看先学卡
          </button>
        </div>
      </div>

      {/* Single Line Task Instruction (HARD RULE: if fault observed, NEVER say "再跑故障") */}
      <div className="bg-slate-800/95 border-l-4 border-amber-500 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 mb-4 shadow flex items-center justify-between">
        <span>
          {phase === 'test_fault' && '任务：先点击「运行路口」，实测当前错误时长配置引发的拥堵反例'}
          {phase === 'fault_running' && '实测中：正在按原配置（机动车绿灯仅 5 秒）模拟运行...'}
          {(phase === 'congested' || phase === 'pick_rule') && '任务：该方向「车很多」，请在下方为该向机动车点选更合理的时长策略'}
          {phase === 'pick_reason' && '任务：请点选选择「给机动车加长」的真实原因理由'}
          {phase === 'revalidate_running' && '核对中：正在按加长时长策略（45秒）重新运行路口...'}
          {phase === 'cleared' && '恭喜！路口车辆顺利放行消堵，完成调度实测，收下时长旋钮！'}
        </span>
        <span className="text-[11px] text-amber-400 font-normal">
          {s3State.faultObserved ? (s3State.revalidateOk ? '已重验疏通' : '已看见故障，换规则中') : '待实测故障'}
        </span>
      </div>

      {/* Dispatch Board Screen */}
      <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
        {/* Visual intersection simulator monitor */}
        <div className="bg-slate-950 rounded-2xl border-2 border-slate-800 p-5 relative overflow-hidden flex flex-col items-center">
          <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold text-cyan-400 tracking-wider">
                莲花山一路·车流监测大屏
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              当前实况：<strong className="text-amber-400">车流量大（高峰期）</strong>
            </div>
          </div>

          {/* Traffic visual track */}
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-4 my-2">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400">南北向机动车道：</span>
              <span className="font-mono font-bold text-amber-400">
                {phase === 'cleared' ? '绿灯时长 45s (合理)' : '预设绿灯时长仅 5s (设错了)'}
              </span>
            </div>

            {/* Cars simulation row */}
            <div className="h-14 bg-slate-950 rounded-lg border border-slate-800 flex items-center px-3 relative overflow-hidden">
              {phase === 'test_fault' && (
                <div className="text-xs text-slate-500 italic mx-auto">
                  尚未运行实测，点击下方「运行路口」按钮启动
                </div>
              )}

              {phase === 'fault_running' && (
                <div className="flex items-center gap-2 animate-pulse mx-auto text-xs text-amber-300">
                  <span>🚗 🚗 🚗 🚗 🚗 正在尝试通过... 5秒后突然变红灯！</span>
                </div>
              )}

              {(phase === 'congested' || phase === 'pick_rule' || phase === 'pick_reason') && (
                <div className="w-full flex items-center justify-between animate-in fade-in">
                  <div className="flex gap-1.5 text-xl">
                    <span className="animate-bounce">🚗</span>
                    <span className="animate-bounce delay-75">🚗</span>
                    <span className="animate-bounce delay-150">🚙</span>
                    <span className="animate-bounce delay-200">🚌</span>
                    <span className="animate-bounce delay-300">🚚</span>
                  </div>
                  <span className="bg-red-500/20 border border-red-500 text-red-400 text-xs px-2.5 py-1 rounded-full font-bold">
                    ⚠️ 严重拥堵！车流长龙排队
                  </span>
                </div>
              )}

              {phase === 'revalidate_running' && (
                <div className="flex items-center gap-2 animate-pulse mx-auto text-xs text-emerald-300">
                  <span>🟢 45秒充足时长：车辆有序快速通过...</span>
                </div>
              )}

              {phase === 'cleared' && (
                <div className="w-full flex items-center justify-between text-xs text-emerald-400 font-bold animate-in fade-in">
                  <div className="flex gap-3 text-xl">
                    <span>🚗 💨</span>
                    <span>🚙 💨</span>
                    <span>🚌 💨</span>
                  </div>
                  <span className="bg-emerald-500/20 border border-emerald-500 px-2.5 py-1 rounded-full">
                    ✓ 通行顺畅，拥堵彻底疏散！
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase controls */}
        {/* Step 1: Run fault */}
        {phase === 'test_fault' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleRunFault}
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition active:scale-95"
            >
              ▶ 运行路口（实测当前配置）
            </button>
          </div>
        )}

        {/* Step 2: Pick strategy when congested */}
        {(phase === 'congested' || phase === 'pick_rule') && (
          <div className="mt-4 pt-3 border-t border-slate-700 animate-in fade-in">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              实测发现拥堵！南北方向「车很多」，请选择更合理的机动车绿灯时长策略：
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { id: 'add_car', label: '给该向机动车加长绿灯 (如45秒)' },
                { id: 'short_car', label: '只加长行人、机动车接近0秒' },
                { id: 'whatever', label: '随便设都一样' },
                { id: 'all_red', label: '改成常红灯' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === 'add_car') {
                      handleSelectStrategy('给该向机动车加长');
                    } else {
                      setScaffoldPrompt('车流很大的方向，必须给予更充裕的放行通行时间，随便设或缩短都会更堵！');
                      setScaffoldLevel(2);
                    }
                  }}
                  className="p-3 rounded-xl border border-slate-700 bg-slate-800 hover:border-amber-400 text-xs font-semibold text-slate-200 hover:text-white transition text-left"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Pick reason */}
        {phase === 'pick_reason' && (
          <div className="mt-4 pt-3 border-t border-slate-700 animate-in fade-in">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              你选择「给机动车加长」的主要理由是？
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '让车更快疏散，小设置服务整条路口' },
                { label: '因为名字叫智慧交通' },
                { label: '设错了也没关系' },
                { label: '只为让大屏幕好看' },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSelectReason(opt.label)}
                  className="p-3 rounded-xl border border-slate-700 bg-slate-800 hover:border-amber-400 text-xs font-semibold text-slate-200 hover:text-white transition text-left"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cleared completion banner */}
        {phase === 'cleared' && (
          <div className="mt-6 p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500 text-center animate-in zoom-in-95">
            <div className="text-4xl mb-2">🚦 ⚙️ 🎉</div>
            <h3 className="font-bold text-base text-emerald-400 mb-1">
              第 3 站完成！收下「时长旋钮」碎片
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto mb-4">
              三枚法宝碎片全部集齐！阿莲说：「你已经完全掌握了过街顺序、循环拆解与时长调度，正式进入当课考核吧！」
            </p>
            <button
              type="button"
              onClick={() => onComplete(s3State)}
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition"
            >
              完成探究，自动开考！→
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
