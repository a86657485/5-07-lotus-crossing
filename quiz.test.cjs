const assert = require('assert');
const { evaluateAnswers, BANK } = require('./quiz.cjs');

function pickCorrectStrings() {
  const answers = {};
  for (const [id, std] of Object.entries(BANK.answers)) {
    if (typeof std === 'object' && std && !Array.isArray(std)) {
      const keys = Object.keys(std);
      if (keys.length === 1) answers[id] = std[keys[0]];
      else answers[id] = { ...std };
    } else {
      answers[id] = std;
    }
  }
  return answers;
}

const asStrings = pickCorrectStrings();
const r1 = evaluateAnswers(asStrings);
assert.strictEqual(r1.baseScore, 16, `expected 16/16 with string card picks, got ${r1.baseScore}`);
assert.ok(r1.details.find(d => d.questionId === 'B04').correct, 'B04 string should score');
assert.ok(r1.details.find(d => d.questionId === 'B05').correct, 'B05 string should score');
assert.ok(r1.details.find(d => d.questionId === 'B10').correct, 'B10 string should score');

const wrong = { ...asStrings, B04: '原地观察红绿灯', B05: '过马路', B10: '继续加热' };
const r2 = evaluateAnswers(wrong);
assert.strictEqual(r2.baseScore, 13, `expected 13/16 when B04/B05/B10 wrong, got ${r2.baseScore}`);

assert.ok(!r2.details.find(d => d.questionId === 'B04').correct);
assert.ok(!r2.details.find(d => d.questionId === 'B05').correct);
assert.ok(!r2.details.find(d => d.questionId === 'B10').correct);

// object-shaped submits still ok

const asObjects = { ...asStrings, B04: { diamond: '绿灯未亮？' }, B05: { repeatRect: '原地观察红绿灯' }, B10: { condition: '水温还低于设定？' } };
const r3 = evaluateAnswers(asObjects);
assert.strictEqual(r3.baseScore, 16, `object-shaped drag_op should also score, got ${r3.baseScore}`);

console.log('quiz.test.cjs OK', { stringAll: r1.baseScore, threeWrong: r2.baseScore, objectAll: r3.baseScore });
