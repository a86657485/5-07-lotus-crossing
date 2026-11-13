import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getStudentQuestions } from '../../data/questionsClient';
import type { ExamAnswer, ExamEvaluationResult, ExamReviewItem, QuestionClient } from '../../types';
import { apiSubmitExam, type ServerState } from '../../api/client';
import {
  answerSlots, hasRecordedCompleteTier, isQuestionComplete, sanitizeExamDraft, selectedOption, type ExamAnswers,
} from '../../utils/examAnswers';
import QuestionFigure, { hasQuestionFigure } from '../lesson/QuestionFigure';
import './examLayout.css';

type Tier = 'base' | 'challenge';
type Feedback = Partial<Record<Tier, ExamReviewItem[]>>;

interface ExamViewProps {
  studentId: string;
  initialAnswers?: ExamAnswers;
  initialResult?: ExamEvaluationResult;
  initialLatestResult?: ExamEvaluationResult;
  initialFirstAnswers?: ExamAnswers | null;
  initialChallengeFirstAnswers?: ExamAnswers | null;
  initialChallengeSubmitted?: boolean;
  initialFeedback?: Feedback;
  rewardUnlocked?: boolean;
  onExamComplete: (result: ExamEvaluationResult, answers: ExamAnswers, state: ServerState) => void;
  onOpenRewardGame?: () => void;
  onBackToMap: () => void;
}

const memoryDrafts = new Map<string, ExamAnswers>();
const optionStyle = 'exam-option rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';
const navStyle = 'rounded-xl border border-slate-600 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40';
const taskLabel: Record<string, string> = {
  s1_order: '第一站·观察信号灯',
  s2_rewrite: '第一站·等灯流程图',
  s2_vs_branch: '第二站·两图比较',
  s2_kettle: '第二站·热水壶流程',
  s3_timing: '第三站·信号时长',
  e6_ac_optional: '第二站·判断与回边',
};

/** Station association for recall art only; not shown as an answer cue. */
const relatedTask: Record<string, string> = {
  B01: 's1_order',
  B04: 's2_rewrite', B05: 's2_rewrite', B06: 's2_rewrite', B07: 's2_rewrite', B12: 's2_rewrite', C06: 's2_rewrite',
  B08: 's2_vs_branch', B09: 's2_vs_branch',
  B10: 's2_kettle', B11: 's2_kettle', C02: 's2_kettle',
  B13: 's3_timing', B14: 's3_timing', B15: 's3_timing', C03: 's3_timing',
  C04: 'e6_ac_optional',
};

function recallArt(question: QuestionClient): { src: string; alt: string } {
  const task = relatedTask[question.id] || '';
  if (task === 's1_order' || task === 's2_rewrite') {
    return { src: '/lesson/story/cg_s1_queue.png', alt: '行人引导台的开放日路口' };
  }
  if (task === 's2_vs_branch' || task === 's2_kettle') {
    return { src: '/lesson/story/cg_s2_panel.png', alt: '信号拆解台的对照画面' };
  }
  if (task === 's3_timing') {
    return { src: '/lesson/story/cg_s3_booth.png', alt: '路口调度台的工作画面' };
  }
  if (question.id === 'B02') {
    return { src: '/lesson/story/cg_intro_crowd.png', alt: '开放日路口的人群' };
  }
  return { src: '/lesson/story/cg_exam_ready.png', alt: '考核前的路口回顾' };
}

function readDraft(key: string, questions: QuestionClient[]): ExamAnswers {
  if (memoryDrafts.has(key)) return memoryDrafts.get(key) || {};
  try {
    return sanitizeExamDraft(questions, JSON.parse(localStorage.getItem(key) || '{}'));
  } catch {
    return {};
  }
}

function RecallPanel({ question }: { question: QuestionClient }) {
  const art = recallArt(question);
  return (
    <aside className="exam-recall" aria-label="情景回忆">
      <img src={art.src} alt={art.alt} data-recall-src={art.src} />
      <p className="exam-recall-caption">回想这一站</p>
    </aside>
  );
}

function AnswerCards({
  question, answer, onSelect,
}: { question: QuestionClient; answer?: ExamAnswer; onSelect: (answer: ExamAnswer) => void }) {
  const [picked, setPicked] = useState('');
  const slot = answerSlots[question.id];
  const placed = selectedOption(question, answer);
  const put = (value: string) => {
    if (!slot || !question.cards?.includes(value)) return;
    onSelect({ [slot.key]: value });
    setPicked('');
  };
  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    put(event.dataTransfer.getData('text/plain'));
  };
  const target = slot && (
    <button
      type="button"
      onClick={() => put(picked)}
      onDragOver={event => event.preventDefault()}
      onDrop={drop}
      aria-label={slot.label}
      className={`${optionStyle} exam-slot ${picked ? 'border-cyan-300 bg-cyan-950' : 'border-slate-400 bg-slate-900'}`}
    >
      {placed || `放入${slot.label}`}
    </button>
  );

  return (
    <>
      {slot && (
        <div className="exam-slot-row">
          {question.type === 'blocks_assemble' ? (
            <div aria-label="待拼接积木" className="exam-blocks">
              <div className="exam-block exam-block-hat">
                {question.fixedBlocks?.[0] || '当开始被点击'}
              </div>
              <div className="exam-block exam-block-loop">
                重复执行直到 {target}
              </div>
              <div className="exam-block exam-block-body">原地观察红绿灯</div>
            </div>
          ) : target}
          <span className="exam-slot-hint">
            {picked ? `已拿起「${picked}」，点槽位放入。` : '拖入虚线槽位，或先点卡片再点槽位。'}
          </span>
        </div>
      )}
      <div className={`exam-options exam-options-${(question.options || question.cards || []).length}`}>
        {(question.options || question.cards || []).map(option => {
          const selected = slot ? picked === option : placed === option;
          return <button
            key={option}
            type="button"
            aria-pressed={selected}
            draggable={!!slot}
            onDragStart={slot ? event => {
              event.dataTransfer.setData('text/plain', option);
              event.dataTransfer.effectAllowed = 'move';
              setPicked(option);
            } : undefined}
            onClick={() => slot ? setPicked(option) : onSelect(option)}
            className={`${optionStyle} ${selected ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800'}`}
          >{option}</button>;
        })}
      </div>
    </>
  );
}

function answerText(value: ExamAnswer, question: QuestionClient): string {
  if (typeof value === 'string') return value;
  if (question.type === 'matching') {
    return (question.rows || []).map(row => `${row.prompt}：${value[row.prompt]}`).join('；');
  }
  return Object.values(value).join('；');
}

export const ExamView: React.FC<ExamViewProps> = ({
  studentId, initialAnswers, initialResult, initialLatestResult, initialFirstAnswers,
  initialChallengeFirstAnswers, initialChallengeSubmitted = false, initialFeedback,
  rewardUnlocked = false, onExamComplete, onOpenRewardGame, onBackToMap,
}) => {
  const questions = useMemo(() => getStudentQuestions(), []);
  const base = useMemo(() => questions.filter(q => q.tier === 'base'), [questions]);
  const challenge = useMemo(() => questions.filter(q => q.tier === 'challenge'), [questions]);
  const draftKey = `lotus.exam.draft.v2:${studentId}`;
  const [saved, setSaved] = useState(() => sanitizeExamDraft(questions, initialAnswers));
  const [draft, setDraft] = useState(() => readDraft(draftKey, questions));
  const [storageIssue, setStorageIssue] = useState(false);
  const [tier, setTier] = useState<Tier>('base');
  const [index, setIndex] = useState(0);
  const [first, setFirst] = useState(initialResult);
  const [latest, setLatest] = useState(initialLatestResult);
  const [baseComplete, setBaseComplete] = useState(!!initialResult && hasRecordedCompleteTier(base, initialFirstAnswers));
  const [challengeComplete, setChallengeComplete] = useState(initialChallengeSubmitted && hasRecordedCompleteTier(challenge, initialChallengeFirstAnswers));
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback || {});
  const [showReview, setShowReview] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const stem = useRef<HTMLHeadingElement>(null);
  const currentQuestions = tier === 'base' ? base : challenge;
  const question = currentQuestions[index];
  const answers = { ...saved, ...draft };
  const incomplete = currentQuestions.filter(q => !isQuestionComplete(q, answers[q.id]));
  const currentComplete = isQuestionComplete(question, answers[question.id]);
  const review = feedback[tier]?.find(item => item.questionId === question.id);
  const showFigure = hasQuestionFigure(question);
  const placed = selectedOption(question, answers[question.id]);

  useEffect(() => { stem.current?.focus({ preventScroll: true }); }, [tier, index]);

  function saveDraft(next: ExamAnswers) {
    memoryDrafts.set(draftKey, next);
    setDraft(next);
    try {
      if (Object.keys(next).length) localStorage.setItem(draftKey, JSON.stringify(next));
      else localStorage.removeItem(draftKey);
      setStorageIssue(false);
    } catch {
      setStorageIssue(true);
    }
  }

  function select(value: ExamAnswer) {
    if (pending.current) return;
    saveDraft({ ...draft, [question.id]: value });
    setSubmitError('');
  }

  function switchTier(next: Tier) {
    if (pending.current || (next === 'challenge' && !baseComplete)) return;
    setTier(next);
    setIndex(0);
    setSubmitError('');
    setShowReview(false);
  }

  async function submit() {
    if (pending.current) return;
    if (incomplete.length) {
      setSubmitError(`还有 ${incomplete.length} 题未答完整：${incomplete.map(q => currentQuestions.indexOf(q) + 1).join('、')}。已定位到第一道未完成题。`);
      setIndex(currentQuestions.indexOf(incomplete[0]));
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setSubmitError('');
    const paper = Object.fromEntries(currentQuestions.map(q => [q.id, answers[q.id]]));
    try {
      const res = await apiSubmitExam(studentId, paper, tier);
      setFirst(res.result);
      setLatest(res.state.examLatestResult || res.result);
      setBaseComplete(!!res.state.examFirstResult && hasRecordedCompleteTier(base, res.state.examFirstAnswers));
      setChallengeComplete(!!res.state.challengeFirstResult && hasRecordedCompleteTier(challenge, res.state.challengeFirstAnswers));
      setSaved(sanitizeExamDraft(questions, res.state.examAnswers));
      saveDraft(Object.fromEntries(Object.entries(draft).filter(([id]) => !Object.hasOwn(paper, id))));
      setFeedback(previous => ({ ...previous, ...res.state.examFeedback }));
      setShowReview(true);
      const firstWrong = res.state.examFeedback?.[tier]?.find(item => !item.correct);
      setIndex(firstWrong ? Math.max(0, currentQuestions.findIndex(q => q.id === firstWrong.questionId)) : 0);
      onExamComplete(res.result, paper, res.state);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请重试');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  const totalAnswered = currentQuestions.length - incomplete.length;
  const feedbackAvailable = !!feedback[tier]?.length;
  const nextAction = !currentComplete ? '请完成本题。' : index < currentQuestions.length - 1
    ? '本题已完成，可以查看下一题。' : incomplete.length ? '本层还有未完成的题，提交时会定位到首个未完成题。'
    : '本层题目已答完整，可以提交。';

  return (
    <main className="exam-shell" data-exam-layout="fill">
      <fieldset disabled={submitting} className="exam-fieldset">
        <legend className="sr-only">课堂综合检测</legend>
        <div className="exam-frame">
          <header className="exam-header">
            <div className="exam-header-left">
              <button type="button" onClick={() => {
                const answeredCount = currentQuestions.filter(q => isQuestionComplete(q, answers[q.id])).length;
                const left = currentQuestions.length - answeredCount;
                if (!baseComplete && answeredCount > 0 && !window.confirm(`还有 ${left} 题没答完。现在离开，这次作答不会保存。确定离开？`)) return;
                onBackToMap();
              }} className={navStyle}>← 返回路口</button>
              <h1>临时小交警 · 课堂综合检测</h1>
            </div>
            <div className="exam-header-tiers">
              <button type="button" aria-pressed={tier === 'base'} onClick={() => switchTier('base')} className={navStyle}>
                基础关（共 {base.length} 题）
              </button>
              <button type="button" aria-pressed={tier === 'challenge'} disabled={!baseComplete}
                onClick={() => switchTier('challenge')} className={navStyle}>
                {baseComplete ? `挑战关（共 ${challenge.length} 题）` : '挑战关（完整提交基础关后解锁）'}
              </button>
            </div>
          </header>
          {(submitError || submitting || storageIssue) && (
            <div role={submitError ? 'alert' : 'status'} className="exam-alert">
              {submitError || (submitting ? '正在提交答卷…' : '此浏览器无法长期暂存草稿。请在关闭或刷新页面前提交。')}
            </div>
          )}
          {first && (
            <aside className="exam-score">
              <div className="exam-score-copy">
                <p className="font-bold">
                  {baseComplete ? '基础层首次得分' : '旧版不完整基础记录'}：{first.baseScore} / {first.baseTotal}
                  {latest && baseComplete && <span className="ml-3 text-slate-300">最近一次：{latest.baseScore} / {latest.baseTotal}</span>}
                </p>
                {!baseComplete && <p className="text-amber-200">旧记录已保留。下一份完整答卷将成为有效基础首答。</p>}
                {baseComplete && (first.passed ? (
                  <p className="text-emerald-300">基础层已达标 —— 可以进入挑战关，也可以直接去玩奖励小游戏。</p>
                ) : (
                  <div className="mt-2 rounded-xl border border-rose-400/40 bg-rose-950/40 px-3 py-2">
                    <p className="font-bold text-rose-200">这次基础层没达标：{first.baseScore} / {first.baseTotal} 题。</p>
                    <p className="mt-1 text-xs text-rose-200/80">首答成绩已记录。把错题改对后可以再提交一次，也可以从头重做一遍。</p>
                    <button type="button" onClick={() => { setTier('base'); setIndex(0); }}
                      className="mt-2 rounded-lg bg-rose-400 px-3 py-1.5 text-xs font-extrabold text-slate-950">回到第 1 题重做</button>
                  </div>
                ))}
                {challengeComplete && <p className="text-purple-200">挑战首答：{first.challengeScore} / {first.challengeTotal}</p>}
                {initialChallengeSubmitted && !challengeComplete && <p className="text-amber-200">旧版挑战记录未答完整。下一份完整挑战卷将成为有效挑战首答。</p>}
              </div>
              {baseComplete && <button type="button" onClick={() => switchTier('challenge')} className={navStyle}>进入挑战关 →</button>}
              {rewardUnlocked && baseComplete && onOpenRewardGame && <button type="button" onClick={onOpenRewardGame}
                className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950">进入奖励小游戏</button>}
            </aside>
          )}

          <section className="exam-stage" data-exam-question={question.id} data-exam-visual={showFigure ? 'figure' : 'recall'}>
            <div className="exam-meta">
              <p>第 {index + 1} 题 / 共 {currentQuestions.length} 题 · 题号：{question.id} · 已答完整 {totalAnswered} 题</p>
              {!baseComplete && (
                <p className="text-xs font-medium text-amber-200/90">
                  答案只存在这台电脑的浏览器里，换设备或清除浏览记录会丢失，答完请马上点「提交」。
                </p>
              )}
              <nav aria-label="题号跳转" className="exam-qnav">
                {currentQuestions.map((q, i) => {
                  const complete = isQuestionComplete(q, answers[q.id]);
                  return <button key={q.id} type="button" data-answered={complete} aria-current={i === index ? 'step' : undefined}
                    title={complete ? '已答完整' : '未答完整'} onClick={() => setIndex(i)}
                    className={`min-h-9 min-w-9 rounded-lg border text-sm ${i === index ? 'border-amber-300 bg-amber-400 text-slate-950' : complete ? 'border-emerald-500 text-emerald-300' : 'border-slate-600 text-slate-300'}`}
                  >{i + 1}</button>;
                })}
              </nav>
            </div>
            <div className={`exam-workspace ${showFigure ? 'has-figure' : 'has-recall'} ${question.id === 'B08' || question.id === 'C02' ? 'has-double' : ''}`}>
              <div className="exam-visual">
                {showFigure
                  ? <QuestionFigure key={question.id} question={question} filledAnswer={placed} />
                  : <RecallPanel key={question.id} question={question} />}
              </div>
              <div className="exam-prompt">
                <h2 ref={stem} tabIndex={-1} className="exam-stem">{question.stem}</h2>
                <p role="status" className="exam-status">{nextAction}</p>
                <div className={`exam-answers ${!currentComplete ? 'is-incomplete' : ''}`}>
                  {question.platform && <p className="exam-platform">平台：{question.platform}</p>}
                  {question.type !== 'matching' ? (
                    <AnswerCards key={question.id} question={question} answer={answers[question.id]} onSelect={select}/>
                  ) : (
                    <div className="exam-match">
                      {question.rows?.map(row => {
                        const value = answers[question.id];
                        const chosen = value && typeof value === 'object' ? value[row.prompt] : undefined;
                        return (
                          <fieldset key={row.prompt} className="exam-match-row">
                            <legend>{row.prompt}</legend>
                            <div className="exam-match-choices">
                              {row.choices.map(choice => (
                                <button key={choice} type="button" aria-pressed={chosen === choice}
                                  onClick={() => select({ ...(typeof value === 'object' ? value : {}), [row.prompt]: choice })}
                                  className={`${optionStyle} ${chosen === choice ? 'border-amber-300 bg-amber-500/20' : 'border-slate-600 bg-slate-800'}`}
                                >{choice}</button>
                              ))}
                            </div>
                          </fieldset>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {feedbackAvailable && (
              <button type="button" aria-expanded={showReview} onClick={() => setShowReview(open => !open)} className={navStyle}>
                {showReview ? '收起上次答卷反馈' : '查看上次答卷反馈'}
              </button>
            )}
            {showReview && review && (
              <aside className="exam-review" aria-label="上次答卷反馈">
                <p className={review.correct ? 'font-bold text-emerald-300' : 'font-bold text-amber-300'}>
                  上次提交：{review.correct ? '答对了' : '需要修订'}
                </p>
                <p>你上次选择：{answerText(review.submittedAnswer, question)}</p>
                <p>参考答案：{answerText(review.correctAnswer, question)}</p>
                <p>{review.analysis}</p>
                {!review.correct && <button type="button" onClick={onBackToMap} className={navStyle}>
                  返回路口回学{review.relatedTaskId && taskLabel[review.relatedTaskId] ? ` · ${taskLabel[review.relatedTaskId]}` : ''}
                </button>}
              </aside>
            )}
            <footer className="exam-footer">
              <button type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)} className={navStyle}>← 上一题</button>
              {index < currentQuestions.length - 1 ? (
                <button type="button" onClick={() => setIndex(i => i + 1)}
                  className={`${navStyle} ${currentComplete ? 'border-cyan-300 bg-cyan-950' : ''}`}>下一题 →</button>
              ) : (
                <button type="button" onClick={() => void submit()}
                  className={`${navStyle} ${incomplete.length ? 'bg-slate-700' : 'bg-amber-400 font-bold text-slate-950'}`}>
                  {tier === 'base' ? (baseComplete ? '重新提交基础关' : `提交基础关答卷 (${base.length}题) →`) : '提交挑战加分答卷 →'}
                </button>
              )}
            </footer>
          </section>
        </div>
      </fieldset>
    </main>
  );
};
