import type { QuestionServer } from '../types';
import design from '../../design/03_questions.json';

/** 教师端命题数据与测试使用。学生考核仅导入 questionsClient。 */
export const SERVER_QUESTIONS: QuestionServer[] = design.questions as QuestionServer[];
export const STANDARD_ANSWERS = Object.fromEntries(design.questions.map(question => [question.id, question.answer]));

export { getStudentQuestions } from './questionsClient';
