import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExam, getGateState, getRelicHint } from './evaluation';
import { STANDARD_ANSWERS } from '../data/questionsData';
import { StationProgress, S3State } from '../types';

test('evaluateExam passes when all base answers are correct', () => {
  const result = evaluateExam(STANDARD_ANSWERS);
  assert.equal(result.baseScore, 16);
  assert.equal(result.baseTotal, 16);
  assert.equal(result.g1Score, 5);
  assert.equal(result.g2Score, 3);
  assert.equal(result.passed, true);
  assert.equal(result.challengeScore, 6);
  assert.equal(result.challengePassed, true);
});

test('evaluateExam passes with threshold >= 13 and G1>=3 and G2>=2', () => {
  // Copy standard answers, fail 3 non-G questions (e.g. B04, B05, B06 which are D1/K2)
  const answers = { ...STANDARD_ANSWERS };
  answers.B04 = 'wrong';
  answers.B05 = 'wrong';
  answers.B06 = 'wrong';

  const result = evaluateExam(answers);
  assert.equal(result.baseScore, 13);
  assert.equal(result.g1Score, 5);
  assert.equal(result.g2Score, 3);
  assert.equal(result.passed, true);
});

test('evaluateExam fails if G1 < 3 even if base score is 13', () => {
  const answers = { ...STANDARD_ANSWERS };
  // Fail 3 G1 questions: B01, B02, B03
  answers.B01 = 'wrong';
  answers.B02 = 'wrong';
  answers.B03 = 'wrong';

  const result = evaluateExam(answers);
  assert.equal(result.baseScore, 13);
  assert.equal(result.g1Score, 2); // 2 < 3
  assert.equal(result.passed, false);
});

test('getGateState locks S3 until S2 is fully completed', () => {
  const progress: StationProgress = {
    s1_order: true,
    s2_rewrite: true,
    s2_vs_branch: false, // incomplete!
    s2_kettle: true,
    s3_timing: false,
    exam: false,
  };
  const gate = getGateState('s3_timing', progress);
  assert.equal(gate, 'pre_missing');
});

test('getGateState unlocks exam when all three stations are completed', () => {
  const progress: StationProgress = {
    s1_order: true,
    s2_rewrite: true,
    s2_vs_branch: true,
    s2_kettle: true,
    s3_timing: true,
    exam: false,
  };
  const gate = getGateState('exam', progress);
  assert.equal(gate, 'verified_ready');
});

test('S3 relic hint NEVER says "再跑一遍故障" if fault is already observed', () => {
  const s3State: S3State = {
    faultObserved: true,
    scenario: 'car_heavy',
    strategy: '',
    reason: '',
    ruleChanged: false,
    revalidateOk: false,
  };
  const hint = getRelicHint('s3_timing', undefined, s3State);
  assert.ok(!hint.includes('再跑一遍故障'));
  assert.ok(!hint.includes('原时长重现'));
  assert.ok(hint.includes('策略') || hint.includes('理由'));
});
