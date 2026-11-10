'use strict';
/** Server-only quiz bank (answers never sent to students). From design/03_questions.json */
const BANK = {
  "version": "2026-11-08-loop-v1.2",
  "tiers": {
    "base": {
      "count": 16,
      "passLine": 13,
      "passLineNote": "老师2026-10-31确认：基础层≥13/16，且每个学习目标至少一半；非另定80%",
      "passRule": "首答对≥13/16，且G1、G2各自至少答对一半（向上取整）",
      "rewardLine": 13,
      "rewardGame": "有效基础首答至少80%解锁；挑战层及分目标门槛不影响奖励",
      "objectiveMinimums": [
        "G1",
        "G2"
      ],
      "objectiveMinimumsNote": "老师2026-11-01确认：按01「学习目标」仅卡G1/G2；K/D基础层覆盖但不另设卡人线",
      "points": 20,
      "pointsRule": "达标与主分只看首次作答；重做入最近/历史，不加分"
    },
    "challenge": {
      "count": 6,
      "unlock": "本轮基础层已提交（≥1次）",
      "passLine": 4,
      "passLineNote": "老师2026-11-01确认：挑战层≥4/6记加分；不影响达标/奖励",
      "points": 5,
      "affectsPass": false
    }
  },
  "questions": [
    {
      "id": "B01",
      "tier": "base",
      "type": "point_select",
      "options": [
        "到达路口",
        "观察并等待绿灯",
        "过马路",
        "到达对面"
      ],
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "到达路口": "M4",
        "过马路": "M4",
        "到达对面": "M4"
      },
      "analysis": "只有观察会在红灯时重复；到达路口和过街是先后发生的一次性步骤。",
      "relatedTaskId": "s1_order"
    },
    {
      "id": "B02",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "灯在选两条不同的路",
        "灯色在循环往复变换",
        "必须先数清换几次",
        "只有绿灯才算循环"
      ],
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "灯在选两条不同的路": "M1",
        "必须先数清换几次": "M2"
      },
      "analysis": "红绿黄交替是循环往复；不是选路，次数也可不定。"
    },
    {
      "id": "B03",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "必须先知道次数",
        "可以事先不知道，亮了就停",
        "只能正好等3次",
        "次数不定就不能画循环"
      ],
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "必须先知道次数": "M2",
        "只能正好等3次": "M2",
        "次数不定就不能画循环": "M2"
      },
      "analysis": "循环可按条件结束；次数不定也成立。"
    },
    {
      "id": "B04",
      "tier": "base",
      "type": "drag_op",
      "cards": [
        "绿灯未亮？",
        "原地观察红绿灯",
        "现在该过马路吗？",
        "过马路"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "原地观察红绿灯": "M3",
        "现在该过马路吗？": "M1",
        "过马路": "M3"
      },
      "analysis": "菱形须是可答是／否的条件；动作不能入菱形。",
      "relatedTaskId": "s2_rewrite"
    },
    {
      "id": "B05",
      "tier": "base",
      "type": "drag_op",
      "cards": [
        "原地观察红绿灯",
        "过马路",
        "到达对面",
        "到达路口"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "过马路": "M4",
        "到达对面": "M4",
        "到达路口": "M4"
      },
      "analysis": "反复的是原地观察；过街与对面在循环外。",
      "relatedTaskId": "s2_rewrite"
    },
    {
      "id": "B06",
      "tier": "base",
      "type": "point_select",
      "options": [
        "接回「原地观察」",
        "接到「过马路」",
        "接到「开始」",
        "接到「到达对面」"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "接到「过马路」": "M3",
        "接到「到达对面」": "M3"
      },
      "analysis": "条件成立＝再做观察；回边接回反复步骤。",
      "relatedTaskId": "s2_rewrite"
    },
    {
      "id": "B07",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "只在等待框写「重复3次」",
        "补判断，绿灯未亮时接回观察",
        "把过街框接回路口",
        "在等待框后加一个结束框"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "只在等待框写「重复3次」": "M2",
        "把过街框接回路口": "M4",
        "在等待框后加一个结束框": "M3"
      },
      "analysis": "“等待”可以概括一串动作。要把循环明确画出来，需要判断是否继续等，并把未亮时的箭头接回观察。",
      "relatedTaskId": "s2_rewrite"
    },
    {
      "id": "B08",
      "tier": "base",
      "type": "dual_diagram_select",
      "options": [
        "图甲",
        "图乙"
      ],
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "图乙": "M1"
      },
      "analysis": "沿箭头检查是否再做一次。图甲在条件成立时返回观察；图乙在两条路中选一条向前走。",
      "relatedTaskId": "s2_vs_branch"
    },
    {
      "id": "B09",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "两条路都向后续步骤走，没有返回先前步骤",
        "菱形有两个出口，就会反复判断",
        "选择否出口，就一定回到菱形",
        "是和否两条路要依次全部走完"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "菱形有两个出口，就会反复判断": "M1",
        "选择否出口，就一定回到菱形": "M3",
        "是和否两条路要依次全部走完": "M1"
      },
      "analysis": "菱形可用于分支或循环。看实际箭头：选路后都向前走，没有接回先前步骤。",
      "relatedTaskId": "s2_vs_branch"
    },
    {
      "id": "B10",
      "tier": "base",
      "type": "drag_op",
      "cards": [
        "水温还低于设定？",
        "继续加热",
        "打开壶盖",
        "到达对面"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "继续加热": "M3"
      },
      "analysis": "条件是可答是／否的问句；继续加热是反复步骤。",
      "relatedTaskId": "s2_kettle"
    },
    {
      "id": "B11",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "先问再做",
        "先做再问",
        "只选一条路的分支",
        "只能先加热"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "先做再问": "M5",
        "只选一条路的分支": "M1",
        "只能先加热": "M5"
      },
      "analysis": "先判断再执行＝先问再做。",
      "relatedTaskId": "s2_kettle"
    },
    {
      "id": "B12",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "菱形里应是可答是／否的条件，不是动作",
        "菱形必须涂成红色",
        "少画了天桥",
        "要把次数写进菱形"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "要把次数写进菱形": "M2"
      },
      "analysis": "菱形内容须是条件；动作放矩形。",
      "relatedTaskId": "s2_rewrite"
    },
    {
      "id": "B13",
      "tier": "base",
      "type": "strategy_select",
      "options": [
        "适当增加车多方向的放行时间",
        "缩短车多方向的放行时间",
        "把两个机动车方向都设成同样长",
        "保持原方案，不再比较"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "缩短车多方向的放行时间": "M7",
        "把两个机动车方向都设成同样长": "M7",
        "保持原方案，不再比较": "M7"
      },
      "analysis": "在满足其他方向及行人通行限制时，可先给车多方向增加放行时间，再用同样的车流条件重跑比较。",
      "relatedTaskId": "s3_timing"
    },
    {
      "id": "B14",
      "tier": "base",
      "type": "single_choice",
      "options": [
        "乙使第一侧少等，也使第二侧多等",
        "乙让两侧排队都变少",
        "甲让第一侧排队比乙少",
        "两方案对第二侧的影响相同"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "乙让两侧排队都变少": "M7",
        "甲让第一侧排队比乙少": "M7",
        "两方案对第二侧的影响相同": "M7"
      },
      "analysis": "第一侧由9降到6，第二侧由3升到7。评价方案要同时看两侧，不能只凭一侧变好便断定全路口变好。",
      "relatedTaskId": "s3_timing"
    },
    {
      "id": "B15",
      "tier": "base",
      "type": "strategy_select",
      "options": [
        "加长行人通行时间",
        "只加长机动车绿灯",
        "取消所有条件判断",
        "灯时长必须全年固定"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "取消所有条件判断": "M6",
        "灯时长必须全年固定": "M7"
      },
      "analysis": "人群聚集处加长行人通行时间。",
      "relatedTaskId": "s3_timing"
    },
    {
      "id": "B16",
      "tier": "base",
      "type": "matching",
      "rows": [
        {
          "prompt": "等绿灯过街",
          "choices": [
            "原地观察／绿灯亮停",
            "过马路／到对面停",
            "数满3次就停"
          ],
          "answer": "原地观察／绿灯亮停"
        },
        {
          "prompt": "保温壶加热",
          "choices": [
            "继续加热／达设定停",
            "只加热一次",
            "打开盖子作条件"
          ],
          "answer": "继续加热／达设定停"
        },
        {
          "prompt": "红绿黄交替",
          "choices": [
            "按序换灯色／一轮后再来",
            "只亮一次绿灯",
            "选上天桥"
          ],
          "answer": "按序换灯色／一轮后再来"
        }
      ],
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "数满3次就停": "M2",
        "过马路／到对面停": "M4",
        "选上天桥": "M1",
        "只加热一次": "M2",
        "打开盖子作条件": "M3",
        "只亮一次绿灯": "M2"
      },
      "analysis": "三例都有反复步骤＋停止条件；次数不必预先固定。"
    },
    {
      "id": "C01",
      "tier": "challenge",
      "type": "single_choice",
      "options": [
        "回边应接回「原地观察」",
        "菱形颜色不对",
        "少了天桥框",
        "「到达对面」也要放进反复框"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "「到达对面」也要放进反复框": "M4"
      },
      "analysis": "回边接错会导致未亮灯就过街。"
    },
    {
      "id": "C02",
      "tier": "challenge",
      "type": "dual_diagram_select",
      "options": [
        "只有图甲",
        "只有图乙",
        "两张图都会不加热",
        "两张图都会先加热一次"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "只有图乙": "M5",
        "两张图都会不加热": "M5",
        "两张图都会先加热一次": "M5"
      },
      "analysis": "从第一个框开始走。图甲先读温判断，达到设定就停止；图乙的第一步是加热，至少会执行一次。",
      "relatedTaskId": "s2_kettle"
    },
    {
      "id": "C03",
      "tier": "challenge",
      "type": "strategy_select",
      "options": [
        "预留更长反应／通行时间",
        "全部改闪烁、不管车流",
        "取消行人灯",
        "时长与天气无关"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "时长与天气无关": "M7"
      },
      "analysis": "可按天气预留更长通行／反应时间。",
      "relatedTaskId": "s3_timing"
    },
    {
      "id": "C04",
      "tier": "challenge",
      "type": "single_choice",
      "options": [
        "不能，缺少反复判断与回边",
        "能，读一次温度就够",
        "能，制冷会自己永远转",
        "不能，因为少写了「开始」"
      ],
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "能，读一次温度就够": "M5",
        "能，制冷会自己永远转": "M5"
      },
      "analysis": "自动调温靠条件＋回边反复；缺回边无法持续调控。",
      "relatedTaskId": "e6_ac_optional"
    },
    {
      "id": "C05",
      "tier": "challenge",
      "type": "blocks_assemble",
      "cards": [
        "绿灯亮起",
        "绿灯未亮",
        "过马路",
        "重复执行 (10) 次",
        "如果〈　〉否则"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "绿灯未亮": "M3",
        "重复执行 (10) 次": "M2",
        "如果〈　〉否则": "M1"
      },
      "analysis": "重复执行直到〈绿灯亮起〉时结束；内层反复观察。"
    },
    {
      "id": "C06",
      "tier": "challenge",
      "type": "single_choice",
      "options": [
        "只把「观察等待」拆成带回边的反复，过街与对面留在循环外",
        "全部删掉只留菱形",
        "改成天桥分支",
        "把次数写成100"
      ],
      "goalIds": [],
      "misconceptionMap": {
        "改成天桥分支": "M1",
        "把次数写成100": "M2"
      },
      "analysis": "只拆真正反复的一步；整段圈入是M4。",
      "relatedTaskId": "s2_rewrite"
    }
  ],
  "answers": {
    "B01": "观察并等待绿灯",
    "B02": "灯色在循环往复变换",
    "B03": "可以事先不知道，亮了就停",
    "B04": {
      "diamond": "绿灯未亮？"
    },
    "B05": {
      "repeatRect": "原地观察红绿灯"
    },
    "B06": "接回「原地观察」",
    "B07": "补判断，绿灯未亮时接回观察",
    "B08": "图甲",
    "B09": "两条路都向后续步骤走，没有返回先前步骤",
    "B10": {
      "condition": "水温还低于设定？"
    },
    "B11": "先问再做",
    "B12": "菱形里应是可答是／否的条件，不是动作",
    "B13": "适当增加车多方向的放行时间",
    "B14": "乙使第一侧少等，也使第二侧多等",
    "B15": "加长行人通行时间",
    "B16": {
      "等绿灯过街": "原地观察／绿灯亮停",
      "保温壶加热": "继续加热／达设定停",
      "红绿黄交替": "按序换灯色／一轮后再来"
    },
    "C01": "回边应接回「原地观察」",
    "C02": "只有图甲",
    "C03": "预留更长反应／通行时间",
    "C04": "不能，缺少反复判断与回边",
    "C05": {
      "untilCondition": "绿灯亮起"
    },
    "C06": "只把「观察等待」拆成带回边的反复，过街与对面留在循环外"
  }
};

const QUESTIONS_BY_ID = new Map(BANK.questions.map(q => [q.id, q]));
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function answerScalar(value) {
  if (typeof value === 'string') return value.trim();
  if (!isRecord(value)) return null;
  const values = Object.values(value);
  return values.length === 1 && typeof values[0] === 'string' ? values[0].trim() : null;
}

// Archived option wording is allowed to differ from the current bank.
function hasCompleteRecordedAnswers(answers, tier) {
  if (!isRecord(answers)) return false;
  return BANK.questions.filter(q => q.tier === tier).every(q => {
    if (!Object.hasOwn(answers, q.id)) return false;
    const value = answers[q.id];
    if (q.type === 'matching') {
      return isRecord(value) && q.rows.every(row => Object.hasOwn(value, row.prompt) &&
        typeof value[row.prompt] === 'string' && value[row.prompt].trim());
    }
    return !!answerScalar(value);
  });
}

function validateSubmission(answers, tier) {
  const questions = BANK.questions.filter(q => q.tier === tier);
  const missing = [];
  const invalid = [];
  const normalized = {};
  for (const q of questions) {
    if (!Object.hasOwn(answers, q.id)) {
      missing.push(q.id);
      continue;
    }
    const value = answers[q.id];
    if (q.type === 'matching') {
      if (!isRecord(value) || Object.keys(value).some(key => !q.rows.some(row => row.prompt === key)) ||
          q.rows.some(row => Object.hasOwn(value, row.prompt) && !row.choices.includes(value[row.prompt]))) {
        invalid.push(q.id);
      } else if (q.rows.some(row => !Object.hasOwn(value, row.prompt))) {
        missing.push(q.id);
      } else {
        normalized[q.id] = value;
      }
      continue;
    }
    const standard = BANK.answers[q.id];
    const slot = isRecord(standard) ? Object.keys(standard)[0] : null;
    const shaped = typeof value === 'string' || (slot && isRecord(value) &&
      Object.keys(value).length === 1 && Object.hasOwn(value, slot) && typeof value[slot] === 'string');
    if (!shaped || !(q.options || q.cards || []).includes(answerScalar(value))) {
      invalid.push(q.id);
      continue;
    }
    normalized[q.id] = slot ? { [slot]: answerScalar(value) } : answerScalar(value);
  }
  return { missing, invalid, normalized };
}

function evaluateAnswers(answers) {
  const base = BANK.questions.filter(q => q.tier === 'base');
  const challenge = BANK.questions.filter(q => q.tier === 'challenge');
  const correctIds = new Set();
  const details = BANK.questions.map(q => {
    const response = answers?.[q.id];
    const expected = BANK.answers[q.id];
    const correct = q.type === 'matching'
      ? isRecord(response) && Object.keys(expected).every(key => response[key] === expected[key])
      : answerScalar(response) !== null && answerScalar(response) === answerScalar(expected);
    if (correct) correctIds.add(q.id);
    const wrongChoices = q.type === 'matching'
      ? isRecord(response) ? Object.keys(expected).filter(key => response[key] !== expected[key]).map(key => response[key]) : []
      : [answerScalar(response)];
    const misconceptionIds = correct ? [] : [...new Set(wrongChoices.filter(choice =>
      typeof choice === 'string' && Object.hasOwn(q.misconceptionMap, choice)
    ).map(choice => q.misconceptionMap[choice]))];
    return {
      questionId: q.id, correct, tier: /** @type {'base' | 'challenge'} */ (q.tier),
      ...(misconceptionIds.length ? { misconceptionId: misconceptionIds[0], misconceptionIds } : {}),
    };
  });
  const countCorrect = questions => questions.filter(q => correctIds.has(q.id)).length;
  const g1 = base.filter(q => q.goalIds.includes('G1'));
  const g2 = base.filter(q => q.goalIds.includes('G2'));
  const baseScore = countCorrect(base);
  const g1Score = countCorrect(g1);
  const g2Score = countCorrect(g2);
  const challengeScore = countCorrect(challenge);
  const passed = baseScore >= BANK.tiers.base.passLine && g1Score >= Math.ceil(g1.length / 2) && g2Score >= Math.ceil(g2.length / 2);
  return {
    baseScore, baseTotal: base.length, g1Score, g1Total: g1.length, g2Score, g2Total: g2.length, passed,
    challengeScore, challengeTotal: challenge.length, challengePassed: challengeScore >= BANK.tiers.challenge.passLine,
    details, rewardUnlocked: baseScore >= BANK.tiers.base.rewardLine,
  };
}

function examFeedback(tier, submitted, result) {
  return result.details.filter(row => row.tier === tier).map(row => {
    const q = QUESTIONS_BY_ID.get(row.questionId);
    return {
      questionId: row.questionId,
      correct: row.correct,
      submittedAnswer: submitted[q.id],
      correctAnswer: BANK.answers[q.id],
      analysis: q.analysis,
      relatedTaskId: q.relatedTaskId,
    };
  });
}

function publicQuestions() {
  return BANK.questions.map(({ id, tier, type }) => ({ id, tier, type }));
}

module.exports = {
  BANK, evaluateAnswers, answerScalar, publicQuestions, validateSubmission, hasCompleteRecordedAnswers,
  examFeedback, isExamQuestionId: id => QUESTIONS_BY_ID.has(id), QUIZ_VERSION: BANK.version,
};
