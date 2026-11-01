import { ExamEvaluationResult } from '../types';
import { SERVER_QUESTIONS, STANDARD_ANSWERS } from '../data/questionsData';

export function evaluateExam(answers: Record<string, any>): ExamEvaluationResult {
  let baseScore = 0;
  let g1Score = 0;
  let g2Score = 0;
  let challengeScore = 0;

  const baseQuestions = SERVER_QUESTIONS.filter(q => q.tier === 'base');
  const challengeQuestions = SERVER_QUESTIONS.filter(q => q.tier === 'challenge');

  const g1Questions = baseQuestions.filter(q => q.goalIds.includes('G1')).map(q => q.id);
  const g2Questions = baseQuestions.filter(q => q.goalIds.includes('G2')).map(q => q.id);

  const details: ExamEvaluationResult['details'] = [];

  for (const q of SERVER_QUESTIONS) {
    const userAnswer = answers[q.id];
    const stdAnswer = STANDARD_ANSWERS[q.id];
    let isCorrect = false;

    if (userAnswer !== undefined && userAnswer !== null) {
      if (q.type === 'matching') {
        if (typeof userAnswer === 'object' && typeof stdAnswer === 'object') {
          const keys = Object.keys(stdAnswer);
          isCorrect = keys.length > 0 && keys.every(k => userAnswer[k] === stdAnswer[k]);
        }
      } else {
        isCorrect = String(userAnswer).trim() === String(stdAnswer).trim();
      }
    }

    let misconceptionId: string | undefined;
    if (!isCorrect && typeof userAnswer === 'string' && q.misconceptionMap[userAnswer]) {
      misconceptionId = q.misconceptionMap[userAnswer];
    }

    details.push({
      questionId: q.id,
      correct: isCorrect,
      tier: q.tier,
      misconceptionId,
    });

    if (q.tier === 'base') {
      if (isCorrect) {
        baseScore++;
        if (g1Questions.includes(q.id)) g1Score++;
        if (g2Questions.includes(q.id)) g2Score++;
      }
    } else {
      if (isCorrect) {
        challengeScore++;
      }
    }
  }

  // Pass rule: Base score >= 13/16, G1 >= 3/5, G2 >= 2/3
  const passed = baseScore >= 13 && g1Score >= 3 && g2Score >= 2;
  const challengePassed = challengeScore >= 4;

  return {
    baseScore,
    baseTotal: baseQuestions.length, // 16
    g1Score,
    g1Total: g1Questions.length,     // 5
    g2Score,
    g2Total: g2Questions.length,     // 3
    passed,
    challengeScore,
    challengeTotal: challengeQuestions.length, // 6
    challengePassed,
    details,
  };
}

