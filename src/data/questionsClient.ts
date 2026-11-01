import { QuestionClient } from '../types';

/** Student-safe question payload (no answer/analysis/misconceptionMap). */
export const STUDENT_QUESTIONS: QuestionClient[] = [
  {
    "id": "B01",
    "tier": "base",
    "type": "point_select",
    "stem": "你在莲花山路口帮行人过街。哪一步其实在「一直等到某事」？",
    "options": [
      "到达路口",
      "观察并等待绿灯",
      "过马路",
      "到达对面"
    ]
  },
  {
    "id": "B02",
    "tier": "base",
    "type": "single_choice",
    "stem": "路口灯色红→绿→黄→红……这主要说明什么？",
    "options": [
      "灯在选两条不同的路",
      "灯色在循环往复变换",
      "必须先数清换几次",
      "只有绿灯才算循环"
    ],
    "pureText": true
  },
  {
    "id": "B03",
    "tier": "base",
    "type": "single_choice",
    "stem": "等绿灯时，要不要事先知道「一共等几次」才能画循环？",
    "options": [
      "必须先知道次数",
      "可以事先不知道，亮了就停",
      "只能正好等3次",
      "次数不定就不能画循环"
    ],
    "pureText": true
  },
  {
    "id": "B04",
    "tier": "base",
    "type": "drag_op",
    "stem": "把「观察并等待」改成带回箭头的图。菱形里该放哪句？",
    "cards": [
      "绿灯未亮？",
      "原地观察红绿灯",
      "现在该过马路吗？",
      "过马路"
    ]
  },
  {
    "id": "B05",
    "tier": "base",
    "type": "drag_op",
    "stem": "条件成立时，反复做的矩形步骤是？",
    "cards": [
      "原地观察红绿灯",
      "过马路",
      "到达对面",
      "到达路口"
    ]
  },
  {
    "id": "B06",
    "tier": "base",
    "type": "point_select",
    "stem": "回边箭头应从菱形「还要再等」的一侧接到哪里？",
    "options": [
      "接回「原地观察」",
      "接到「过马路」",
      "接到「开始」",
      "接到「到达对面」"
    ]
  },
  {
    "id": "B07",
    "tier": "base",
    "type": "single_choice",
    "stem": "图上只有：到达→观察等待→过街→对面，没有回箭头。能否表示「一直等到绿灯」？",
    "options": [
      "能，有顺序就够",
      "不能，缺「还要不要再等」的回边",
      "能，写下「等待」即可",
      "不能，因为少了天桥"
    ],
    "diagramRef": "order_no_backedge"
  },
  {
    "id": "B08",
    "tier": "base",
    "type": "dual_diagram_select",
    "stem": "两张图都有菱形。哪张在问「还要不要再等」？",
    "options": [
      "左图（带回边的等灯循环）",
      "右图（有天桥吗→上天桥／等灯）"
    ]
  },
  {
    "id": "B09",
    "tier": "base",
    "type": "single_choice",
    "stem": "同伴把「有天桥吗→上天桥／等灯」说成循环。主要错在哪？",
    "options": [
      "这是选路，常各走一次，没有「再做一遍」的回边",
      "天桥不能画进图",
      "分支不能有菱形",
      "必须先问水温"
    ],
    "diagramRef": "branch_bridge"
  },
  {
    "id": "B10",
    "tier": "base",
    "type": "drag_op",
    "stem": "志愿者休息点保温壶图。循环条件（在问什么）是？",
    "cards": [
      "水温还低于设定？",
      "继续加热",
      "打开壶盖",
      "到达对面"
    ]
  },
  {
    "id": "B11",
    "tier": "base",
    "type": "single_choice",
    "stem": "保温壶图先「读水温并比较」，再决定是否加热。这是？",
    "options": [
      "先问再做",
      "先做再问",
      "只选一条路的分支",
      "只能先加热"
    ],
    "diagramRef": "kettle_ask_first"
  },
  {
    "id": "B12",
    "tier": "base",
    "type": "single_choice",
    "stem": "有人在菱形里写「原地观察红绿灯」。这样画主要错在哪？",
    "options": [
      "菱形里应是可答是／否的条件，不是动作",
      "菱形必须涂成红色",
      "少画了天桥",
      "要把次数写进菱形"
    ],
    "diagramRef": "diamond_has_action"
  },
  {
    "id": "B13",
    "tier": "base",
    "type": "strategy_select",
    "stem": "调度台：该方向「车很多」。机动车绿灯时长更合理的是？",
    "options": [
      "给该向机动车加长",
      "只加长行人、缩短机动车到接近0",
      "随便设都一样",
      "改成常红"
    ]
  },
  {
    "id": "B14",
    "tier": "base",
    "type": "single_choice",
    "stem": "你选「加长」的主要理由是？",
    "options": [
      "让车更快疏散，小设置服务整条路口",
      "因为名字叫智慧交通",
      "设错了也没关系",
      "只为让屏幕好看"
    ],
    "pureText": true
  },
  {
    "id": "B15",
    "tier": "base",
    "type": "strategy_select",
    "stem": "开放日「人很多」。更合理的时长策略是？",
    "options": [
      "加长行人通行时间",
      "只加长机动车绿灯",
      "取消所有条件判断",
      "灯时长必须全年固定"
    ]
  },
  {
    "id": "B16",
    "tier": "base",
    "type": "matching",
    "stem": "把现象与「反复做什么／何时停」配对（每行点选一卡）。",
    "rows": [
      {
        "prompt": "等绿灯过街",
        "choices": [
          "原地观察／绿灯亮停",
          "过马路／到对面停",
          "数满3次就停"
        ]
      },
      {
        "prompt": "保温壶加热",
        "choices": [
          "继续加热／达设定停",
          "只加热一次",
          "打开盖子作条件"
        ]
      },
      {
        "prompt": "红绿黄交替",
        "choices": [
          "按序换灯色／一轮后再来",
          "只亮一次绿灯",
          "选上天桥"
        ]
      }
    ]
  },
  {
    "id": "C01",
    "tier": "challenge",
    "type": "single_choice",
    "stem": "回边被接到「过马路」。回放：绿灯未亮人却走上斑马线。错在哪？",
    "options": [
      "回边应接回「原地观察」",
      "菱形颜色不对",
      "少了天桥框",
      "「到达对面」也要放进反复框"
    ],
    "diagramRef": "backedge_to_cross"
  },
  {
    "id": "C02",
    "tier": "challenge",
    "type": "dual_diagram_select",
    "stem": "图甲：先比水温再加热。图乙：先加热再问够不够。图甲是？",
    "options": [
      "先问再做",
      "先做再问",
      "分支选路",
      "必须预先知道次数"
    ]
  },
  {
    "id": "C03",
    "tier": "challenge",
    "type": "strategy_select",
    "stem": "暴雨天视线差。信号时长更合理的是？",
    "options": [
      "预留更长反应／通行时间",
      "全部改闪烁、不管车流",
      "取消行人灯",
      "时长与天气无关"
    ]
  },
  {
    "id": "C04",
    "tier": "challenge",
    "type": "single_choice",
    "stem": "休息室空调图若去掉「室温＞预期」一侧的回边，还能一直自动调温吗？",
    "options": [
      "不能，缺少反复判断与回边",
      "能，读一次温度就够",
      "能，制冷会自己永远转",
      "不能，因为少写了「开始」"
    ],
    "diagramRef": "ac_no_backedge_b18"
  },
  {
    "id": "C05",
    "tier": "challenge",
    "type": "blocks_assemble",
    "stem": "用积木表示「重复观察，直到绿灯亮」。`重复执行直到` 的条件格应放？",
    "cards": [
      "绿灯亮起",
      "绿灯未亮",
      "过马路",
      "重复执行 (10) 次",
      "如果〈　〉否则"
    ],
    "platform": "编程猫Kitten",
    "fixedBlocks": [
      "当开始被点击",
      "重复执行直到〈　〉"
    ],
    "blockMeta": [
      {
        "label": "当开始被点击",
        "category": "事件",
        "verifiedName": true
      },
      {
        "label": "重复执行直到〈　〉",
        "category": "控制",
        "verifiedName": true
      },
      {
        "label": "如果〈　〉否则",
        "category": "控制",
        "verifiedName": true
      }
    ]
  },
  {
    "id": "C06",
    "tier": "challenge",
    "type": "single_choice",
    "stem": "有人把「到达→等待→过街→对面」整段都圈成循环。最小改法是？",
    "options": [
      "只把「观察等待」拆成带回边的反复，过街与对面留在循环外",
      "全部删掉只留菱形",
      "改成天桥分支",
      "把次数写成100"
    ],
    "diagramRef": "whole_sequence_looped"
  }
];

export function getStudentQuestions(): QuestionClient[] {
  return STUDENT_QUESTIONS.map(q => ({ ...q }));
}
