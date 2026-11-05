import React, { useState, useMemo } from 'react';
import { getStudentQuestions } from '../../data/questionsClient';
import { ExamEvaluationResult, QuestionClient } from '../../types';
import { apiSubmitExam, ServerState } from '../../api/client';

interface ExamViewProps {
  studentId: string;
  initialAnswers?: Record<string, any>;
  initialResult?: ExamEvaluationResult;
  initialChallengeSubmitted?: boolean;
  onExamComplete: (result: ExamEvaluationResult, answers: Record<string, any>, state: ServerState) => void;
  onOpenRewardGame?: () => void;
  onBackToMap: () => void;
}

export const ExamView: React.FC<ExamViewProps> = ({
  studentId,
  initialAnswers,
  initialResult,
  initialChallengeSubmitted = false,
  onExamComplete,
  onOpenRewardGame,
  onBackToMap,
}) => {
  const allQuestions = useMemo(() => getStudentQuestions(), []);
  const baseQuestions = useMemo(() => allQuestions.filter(q => q.tier === 'base'), [allQuestions]);
  const challengeQuestions = useMemo(() => allQuestions.filter(q => q.tier === 'challenge'), [allQuestions]);

  const [activeTier, setActiveTier] = useState<'base' | 'challenge'>('base');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers || {});
  const [examSubmitted, setExamSubmitted] = useState(!!initialResult);
  const [examResult, setExamResult] = useState<ExamEvaluationResult | null>(initialResult || null);
  const [challengeSubmitted, setChallengeSubmitted] = useState(initialChallengeSubmitted);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentQuestions = activeTier === 'base' ? baseQuestions : challengeQuestions;
  const currentQ = currentQuestions[currentQIndex] || currentQuestions[0];
  // design/05 §4.2: challenge unlocks after the base submission; bonus is separate.
  const challengeUnlocked = examSubmitted;

  const handleSelectOption = (qid: string, val: any) => {
    setAnswers(prev => ({ ...prev, [qid]: val }));
  };

  const handleSelectMatching = (qid: string, prompt: string, choice: string) => {
    setAnswers(prev => {
      const existing = prev[qid] || {};
      return {
        ...prev,
        [qid]: {
          ...existing,
          [prompt]: choice,
        },
      };
    });
  };

  const submitToServer = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await apiSubmitExam(studentId, answers, activeTier);
      setExamResult(res.result);
      setExamSubmitted(true);
      setChallengeSubmitted(!!res.state.challengeFirstResult);
      onExamComplete(res.result, answers, res.state);
    } catch (err: any) {
      setSubmitError(err?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBaseExam = () => {
    void submitToServer();
  };

  const handleSubmitChallenge = () => {
    void submitToServer();
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 select-none">
      {(submitError || submitting) && (
        <div className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-1.5 rounded-lg shadow ${submitError ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
          {submitError || '正在提交到课堂服务…'}
        </div>
      )}
      {/* Top Header */}
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
              临时小交警 · 课堂综合检测
            </h1>
          </div>
        </div>

        {/* Tier switcher tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTier('base');
              setCurrentQIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              activeTier === 'base'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            基础关（共 16 题）
          </button>

          <button
            type="button"
            disabled={!challengeUnlocked}
            title={challengeUnlocked ? '基础层已提交，可进入挑战关' : '请先提交基础关'}
            onClick={() => {
              if (!challengeUnlocked) return;
              setActiveTier('challenge');
              setCurrentQIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              !challengeUnlocked
                ? 'opacity-40 border-slate-800 bg-slate-800 text-slate-500 cursor-not-allowed'
                : activeTier === 'challenge'
                ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                : 'bg-slate-800 text-purple-200 border-purple-400 hover:bg-purple-900/40 ring-1 ring-purple-400/50'
            }`}
          >
            {challengeUnlocked
              ? (activeTier === 'challenge' ? '挑战关（作答中 · 6 题）' : '挑战关 · 已解锁（点此进入）')
              : '挑战关（提交基础关后解锁）'}
          </button>
        </div>
      </div>

      {/* Result summary banner if submitted */}
      {examSubmitted && examResult && (
        <div className="mb-4 p-4 rounded-2xl bg-slate-800 border-2 border-amber-500/80 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
              examResult.passed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' : 'bg-amber-500/20 text-amber-400 border border-amber-500'
            }`}>
              {examResult.passed ? '✓' : '★'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  基础层得分：{examResult.baseScore} / {examResult.baseTotal}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  examResult.passed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {examResult.passed ? '已达标（≥13题且目标过半）' : '继续加油'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {examResult.passed
                  ? '挑战关已解锁：点右上「挑战关 · 已解锁」或下方按钮进入加分题。'
                  : '基础首答已保存。可查看作答并进入挑战关；挑战加分不改变基础达标结果。'}
              </p>
              {challengeSubmitted && (
                <p className="text-xs text-purple-200 mt-1">
                  挑战首答：{examResult.challengeScore} / {examResult.challengeTotal}
                  {examResult.challengePassed ? ' · 已达加分线（≥4/6）' : ' · 未达加分线（4/6）'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {challengeUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setActiveTier('challenge');
                  setCurrentQIndex(0);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition"
              >
                进入挑战关 →
              </button>
            )}
            {examResult.passed && onOpenRewardGame && (
              <button
                type="button"
                onClick={onOpenRewardGame}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              >
                <span>🎮 解锁奖励小游戏</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Question Card Area */}
      <div className="flex-1 bg-slate-800/60 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between shadow-xl backdrop-blur">
        {/* Question Header & Navigation */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                第 {currentQIndex + 1} 题 / 共 {currentQuestions.length} 题
              </span>
              <span className="text-xs text-slate-400">
                题号：{currentQ.id}
              </span>
            </div>

            {/* Quick question index dots */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-xs py-1">
              {currentQuestions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentQIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-6 h-6 rounded-md text-[10px] font-bold transition flex items-center justify-center ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                        : isAnswered
                        ? 'bg-slate-700 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Stem */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-100 leading-relaxed mb-2">
              {currentQ.stem}
            </h3>

            {/* Diagram reference schematic if applicable */}
            {currentQ.diagramRef && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-700 my-3 text-xs text-slate-300">
                <span className="text-amber-400 font-semibold">【流程图提示】：</span>
                {currentQ.diagramRef === 'order_no_backedge' && '到达路口 ➜ 观察并等待绿灯 ➜ 过马路 ➜ 到达对面（无回箭头）'}
                {currentQ.diagramRef === 'branch_bridge' && '天桥分支：有天桥吗？是➜走天桥 / 否➜等绿灯过街（各自往前，无回边）'}
                {currentQ.diagramRef === 'kettle_ask_first' && '保温壶：水温低于设定？是➜继续加热➜测温 / 否➜停止加热'}
                {currentQ.diagramRef === 'diamond_has_action' && '图中菱形框内写有动作「原地观察红绿灯」'}
                {currentQ.diagramRef === 'backedge_to_cross' && '回边接到了「过马路」框'}
                {currentQ.diagramRef === 'ac_no_backedge_b18' && '空调调温流程图中去掉了回边箭头'}
                {currentQ.diagramRef === 'whole_sequence_looped' && '把到达、等待、过街、对面整段都圈进了大回边'}
              </div>
            )}

            {currentQ.platform && (
              <div className="inline-block px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[11px] font-semibold mb-3 border border-blue-500/40">
                平台：{currentQ.platform}
              </div>
            )}
          </div>

          {/* Interactive Answer Input based on type */}
          {/* 1. Multiple Choice / Point select / Strategy select */}
          {(currentQ.options || currentQ.cards) && currentQ.type !== 'matching' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(currentQ.options || currentQ.cards || []).map((opt, oIdx) => {
                const isSelected = answers[currentQ.id] === opt;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, opt)}
                    className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-400/50 shadow-md font-bold'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <span>{opt}</span>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                      isSelected ? 'border-amber-400 bg-amber-500 text-slate-950 font-bold' : 'border-slate-600'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Matching type (B16) */}
          {currentQ.type === 'matching' && currentQ.rows && (
            <div className="space-y-3">
              {currentQ.rows.map((row, rIdx) => {
                const selectedChoice = (answers[currentQ.id] || {})[row.prompt];
                return (
                  <div key={rIdx} className="p-3 bg-slate-900/80 rounded-xl border border-slate-700">
                    <div className="text-xs font-bold text-amber-300 mb-2">
                      生活现象：{row.prompt}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {row.choices.map((c, cIdx) => {
                        const isMatchSelected = selectedChoice === c;
                        return (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => handleSelectMatching(currentQ.id, row.prompt, c)}
                            className={`p-2 rounded-lg text-xs font-medium border text-left transition ${
                              isMatchSelected
                                ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400 font-bold'
                                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Navigation & Submit */}
        <div className="mt-8 pt-4 border-t border-slate-700 flex items-center justify-between">
          <button
            type="button"
            disabled={currentQIndex === 0}
            onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 transition"
          >
            ← 上一题
          </button>

          <div className="flex items-center gap-3">
            {currentQIndex < currentQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQIndex(prev => Math.min(currentQuestions.length - 1, prev + 1))}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition"
              >
                下一题 →
              </button>
            ) : (
              activeTier === 'base' ? (
                <button
                  type="button"
                  onClick={handleSubmitBaseExam}
                  className="px-8 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg transition active:scale-95"
                >
                  {examSubmitted ? '重新提交基础关' : '提交基础关答卷 (16题) →'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitChallenge}
                  className="px-8 py-3 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition active:scale-95"
                >
                  提交挑战加分答卷 →
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
