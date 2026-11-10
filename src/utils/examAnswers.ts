import type { ExamAnswer, QuestionClient } from '../types';

export type ExamAnswers = Record<string, ExamAnswer>;
export const answerSlots: Record<string, { key: string; label: string }> = {
  B04: { key: 'diamond', label: '菱形判断槽' },
  B05: { key: 'repeatRect', label: '反复步骤槽' },
  B10: { key: 'condition', label: '水温判断槽' },
  C05: { key: 'untilCondition', label: '积木停止条件槽' },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function selectedOption(question: QuestionClient, value: unknown): string | undefined {
  const slot = answerSlots[question.id]?.key;
  const selected = slot && isObject(value) ? value[slot] : value;
  return typeof selected === 'string' && (question.options || question.cards || []).includes(selected)
    ? selected : undefined;
}

export function isQuestionComplete(question: QuestionClient, value: unknown): boolean {
  if (question.type === 'matching') {
    return isObject(value) && !!question.rows?.length &&
      question.rows.every(row => row.choices.includes(value[row.prompt] as string));
  }
  return selectedOption(question, value) !== undefined;
}

/** Historical first submissions may contain option labels from the previous bank. */
export function hasRecordedCompleteTier(questions: QuestionClient[], answers: unknown): boolean {
  if (!isObject(answers)) return false;
  return questions.every(question => {
    const value = answers[question.id];
    if (question.type === 'matching') return isObject(value) && !!question.rows?.length &&
      question.rows.every(row => typeof value[row.prompt] === 'string' && (value[row.prompt] as string).trim());
    if (typeof value === 'string') return !!value.trim();
    if (!isObject(value)) return false;
    const entries = Object.values(value);
    return entries.length === 1 && typeof entries[0] === 'string' && !!entries[0].trim();
  });
}

export function sanitizeExamDraft(questions: QuestionClient[], value: unknown): ExamAnswers {
  if (!isObject(value)) return {};
  const result: ExamAnswers = {};
  for (const question of questions) {
    const answer = value[question.id];
    if (question.type === 'matching') {
      if (!isObject(answer)) continue;
      const rows: Record<string, string> = {};
      for (const row of question.rows || []) {
        const choice = answer[row.prompt];
        if (typeof choice === 'string' && row.choices.includes(choice)) rows[row.prompt] = choice;
      }
      if (Object.keys(rows).length) result[question.id] = rows;
      continue;
    }
    const choice = selectedOption(question, answer);
    if (!choice) continue;
    const slot = answerSlots[question.id]?.key;
    result[question.id] = slot ? { [slot]: choice } : choice;
  }
  return result;
}
