import type { ExamEvaluationResult } from '../types';
import quiz from '../../quiz.cjs';

/** Assessment tests use the same scoring entry point as the classroom service. */
export function evaluateExam(answers: Record<string, unknown>): ExamEvaluationResult {
  return quiz.evaluateAnswers(answers);
}
