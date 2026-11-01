'use strict';
/** Server-only quiz bank (answers never sent to students). From design/03_questions.json */
const BANK = {
  "version": "2026-11-01-loop-v1.1",
  "tiers": {
    "base": {
      "count": 16,
      "passLine": 13,
      "passLineNote": "老师2026-10-31确认：基础层≥13/16，且每个学习目标至少一半；非另定80%",
      "passRule": "首答对≥13/16，且G1、G2各自至少答对一半（向上取整）",
      "rewardLine": 13,
      "rewardGame": "基础层达达标线后解锁；轻量内嵌回边/红绿切换；禁无关纯娱乐",
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
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "到达路口": "M4",
        "过马路": "M4",
        "到达对面": "M4"
      }
    },
    {
      "id": "B02",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "灯在选两条不同的路": "M1",
        "必须先数清换几次": "M2"
      }
    },
    {
      "id": "B03",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "必须先知道次数": "M2",
        "只能正好等3次": "M2",
        "次数不定就不能画循环": "M2"
      }
    },
    {
      "id": "B04",
      "tier": "base",
      "type": "drag_op",
      "goalIds": [],
      "misconceptionMap": {
        "原地观察红绿灯": "M3",
        "现在该过马路吗？": "M1",
        "过马路": "M3"
      }
    },
    {
      "id": "B05",
      "tier": "base",
      "type": "drag_op",
      "goalIds": [],
      "misconceptionMap": {
        "过马路": "M4",
        "到达对面": "M4",
        "到达路口": "M4"
      }
    },
    {
      "id": "B06",
      "tier": "base",
      "type": "point_select",
      "goalIds": [],
      "misconceptionMap": {
        "接到「过马路」": "M3",
        "接到「到达对面」": "M3"
      }
    },
    {
      "id": "B07",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "能，有顺序就够": "M3",
        "能，写下「等待」即可": "M3"
      }
    },
    {
      "id": "B08",
      "tier": "base",
      "type": "dual_diagram_select",
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "右图（有天桥吗→上天桥／等灯）": "M1"
      }
    },
    {
      "id": "B09",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "天桥不能画进图": "form",
        "分支不能有菱形": "form",
        "必须先问水温": "scene_mix"
      }
    },
    {
      "id": "B10",
      "tier": "base",
      "type": "drag_op",
      "goalIds": [],
      "misconceptionMap": {
        "继续加热": "M3"
      }
    },
    {
      "id": "B11",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "先做再问": "M5",
        "只选一条路的分支": "M1",
        "只能先加热": "M5"
      }
    },
    {
      "id": "B12",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "要把次数写进菱形": "M2"
      }
    },
    {
      "id": "B13",
      "tier": "base",
      "type": "strategy_select",
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "随便设都一样": "M7"
      }
    },
    {
      "id": "B14",
      "tier": "base",
      "type": "single_choice",
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "因为名字叫智慧交通": "M7",
        "设错了也没关系": "M7",
        "只为让屏幕好看": "M7"
      }
    },
    {
      "id": "B15",
      "tier": "base",
      "type": "strategy_select",
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "取消所有条件判断": "M6",
        "灯时长必须全年固定": "M7"
      }
    },
    {
      "id": "B16",
      "tier": "base",
      "type": "matching",
      "goalIds": [
        "G1"
      ],
      "misconceptionMap": {
        "数满3次就停": "M2",
        "过马路／到对面停": "M4",
        "选上天桥": "M1"
      }
    },
    {
      "id": "C01",
      "tier": "challenge",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "「到达对面」也要放进反复框": "M4"
      }
    },
    {
      "id": "C02",
      "tier": "challenge",
      "type": "dual_diagram_select",
      "goalIds": [],
      "misconceptionMap": {
        "先做再问": "M5",
        "分支选路": "M1",
        "必须预先知道次数": "M2"
      }
    },
    {
      "id": "C03",
      "tier": "challenge",
      "type": "strategy_select",
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "时长与天气无关": "M7"
      }
    },
    {
      "id": "C04",
      "tier": "challenge",
      "type": "single_choice",
      "goalIds": [
        "G2"
      ],
      "misconceptionMap": {
        "能，读一次温度就够": "M5",
        "能，制冷会自己永远转": "M5"
      }
    },
    {
      "id": "C05",
      "tier": "challenge",
      "type": "blocks_assemble",
      "goalIds": [],
      "misconceptionMap": {
        "绿灯未亮": "M3",
        "重复执行 (10) 次": "M2",
        "如果〈　〉否则": "M1"
      }
    },
    {
      "id": "C06",
      "tier": "challenge",
      "type": "single_choice",
      "goalIds": [],
      "misconceptionMap": {
        "改成天桥分支": "M1",
        "把次数写成100": "M2"
      }
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
    "B07": "不能，缺「还要不要再等」的回边",
    "B08": "左图（带回边的等灯循环）",
    "B09": "这是选路，常各走一次，没有「再做一遍」的回边",
    "B10": {
      "condition": "水温还低于设定？"
    },
    "B11": "先问再做",
    "B12": "菱形里应是可答是／否的条件，不是动作",
    "B13": "给该向机动车加长",
    "B14": "让车更快疏散，小设置服务整条路口",
    "B15": "加长行人通行时间",
    "B16": {
      "等绿灯过街": "原地观察／绿灯亮停",
      "保温壶加热": "继续加热／达设定停",
      "红绿黄交替": "按序换灯色／一轮后再来"
    },
    "C01": "回边应接回「原地观察」",
    "C02": "先问再做",
    "C03": "预留更长反应／通行时间",
    "C04": "不能，缺少反复判断与回边",
    "C05": {
      "untilCondition": "绿灯亮起"
    },
    "C06": "只把「观察等待」拆成带回边的反复，过街与对面留在循环外"
  }
};

function evaluateAnswers(answers) {
  const baseQs = BANK.questions.filter(q => q.tier === 'base');
  const challengeQs = BANK.questions.filter(q => q.tier === 'challenge');
  const g1Ids = baseQs.filter(q => (q.goalIds || []).includes('G1')).map(q => q.id);
  const g2Ids = baseQs.filter(q => (q.goalIds || []).includes('G2')).map(q => q.id);
  let baseScore = 0, g1Score = 0, g2Score = 0, challengeScore = 0;
  const details = [];
  for (const q of BANK.questions) {
    const userAnswer = answers ? answers[q.id] : undefined;
    const stdAnswer = BANK.answers[q.id];
    let isCorrect = false;
    if (userAnswer !== undefined && userAnswer !== null) {
      if (q.type === 'matching') {
        if (typeof userAnswer === 'object' && typeof stdAnswer === 'object' && stdAnswer) {
          const keys = Object.keys(stdAnswer);
          isCorrect = keys.length > 0 && keys.every(k => userAnswer[k] === stdAnswer[k]);
        }
      } else {
        isCorrect = String(userAnswer).trim() === String(stdAnswer).trim();
      }
    }
    let misconceptionId;
    if (!isCorrect && typeof userAnswer === 'string' && q.misconceptionMap && q.misconceptionMap[userAnswer]) {
      misconceptionId = q.misconceptionMap[userAnswer];
    }
    details.push({ questionId: q.id, correct: !!isCorrect, tier: q.tier, misconceptionId });
    if (q.tier === 'base') {
      if (isCorrect) {
        baseScore++;
        if (g1Ids.includes(q.id)) g1Score++;
        if (g2Ids.includes(q.id)) g2Score++;
      }
    } else if (isCorrect) {
      challengeScore++;
    }
  }
  const passed = baseScore >= 13 && g1Score >= 3 && g2Score >= 2;
  const challengePassed = challengeScore >= 4;
  return {
    baseScore,
    baseTotal: baseQs.length,
    g1Score,
    g1Total: g1Ids.length,
    g2Score,
    g2Total: g2Ids.length,
    passed,
    challengeScore,
    challengeTotal: challengeQs.length,
    challengePassed,
    details,
    rewardUnlocked: passed,
  };
}

function publicQuestions() {
  return BANK.questions.map(({ id, tier, type }) => ({ id, tier, type }));
}

module.exports = { BANK, evaluateAnswers, publicQuestions, QUIZ_VERSION: BANK.version };
