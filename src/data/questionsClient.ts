import { QuestionClient } from '../types';

/** Student-safe projection of design/03_questions.json. */
export const STUDENT_QUESTIONS: QuestionClient[] = [
  {
    "id": "B01",
    "tier": "base",
    "type": "point_select",
    "stem": "过街记录：到路口→看到红灯→再次观察→绿灯亮→过街。哪一步可能做不止一次？",
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
    "pureText": true,
    "stem": "路口灯色红→绿→黄→红……这主要说明什么？",
    "options": [
      "灯在选两条不同的路",
      "灯色在循环往复变换",
      "必须先数清换几次",
      "只有绿灯才算循环"
    ]
  },
  {
    "id": "B03",
    "tier": "base",
    "type": "single_choice",
    "pureText": true,
    "stem": "等绿灯时，要不要事先知道「一共等几次」才能画循环？",
    "options": [
      "必须先知道次数",
      "可以事先不知道，亮了就停",
      "只能正好等3次",
      "次数不定就不能画循环"
    ]
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
    "stem": "图上把等待写成一个步骤。要明确画出红灯时怎样继续观察，应该怎样补图？",
    "diagramRef": "order_no_backedge",
    "options": [
      "只在等待框写「重复3次」",
      "补判断，绿灯未亮时接回观察",
      "把过街框接回路口",
      "在等待框后加一个结束框"
    ]
  },
  {
    "id": "B08",
    "tier": "base",
    "type": "dual_diagram_select",
    "stem": "两张图都有菱形。哪张在问「还要不要再等」？",
    "options": [
      "图甲",
      "图乙"
    ]
  },
  {
    "id": "B09",
    "tier": "base",
    "type": "single_choice",
    "stem": "小明说这张图有菱形，所以是循环。沿图走一遍，怎样说明他的判断不成立？",
    "diagramRef": "branch_bridge",
    "options": [
      "两条路都向后续步骤走，没有返回先前步骤",
      "菱形有两个出口，就会反复判断",
      "选择否出口，就一定回到菱形",
      "是和否两条路要依次全部走完"
    ]
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
    "diagramRef": "kettle_ask_first",
    "options": [
      "先问再做",
      "先做再问",
      "只选一条路的分支",
      "只能先加热"
    ]
  },
  {
    "id": "B12",
    "tier": "base",
    "type": "single_choice",
    "stem": "有人在菱形里写「原地观察红绿灯」。这样画主要错在哪？",
    "diagramRef": "diamond_has_action",
    "options": [
      "菱形里应是可答是／否的条件，不是动作",
      "菱形必须涂成红色",
      "少画了天桥",
      "要把次数写进菱形"
    ]
  },
  {
    "id": "B13",
    "tier": "base",
    "type": "strategy_select",
    "stem": "车多方向的队伍一轮后仍很长。行人和另一方向的最短通行时间不变，应先试哪种方案？",
    "options": [
      "适当增加车多方向的放行时间",
      "缩短车多方向的放行时间",
      "把两个机动车方向都设成同样长",
      "保持原方案，不再比较"
    ]
  },
  {
    "id": "B14",
    "tier": "base",
    "type": "single_choice",
    "pureText": true,
    "stem": "两侧仍排队的车数：方案甲为9和3辆，方案乙为6和7辆。哪条结论符合记录？",
    "options": [
      "乙使第一侧少等，也使第二侧多等",
      "乙让两侧排队都变少",
      "甲让第一侧排队比乙少",
      "两方案对第二侧的影响相同"
    ]
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
    "diagramRef": "backedge_to_cross",
    "options": [
      "回边应接回「原地观察」",
      "菱形颜色不对",
      "少了天桥框",
      "「到达对面」也要放进反复框"
    ]
  },
  {
    "id": "C02",
    "tier": "challenge",
    "type": "dual_diagram_select",
    "stem": "两个保温壶一开始都已达到设定水温。看流程图，哪一种会一次也不加热？",
    "options": [
      "只有图甲",
      "只有图乙",
      "两张图都会不加热",
      "两张图都会先加热一次"
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
    "diagramRef": "ac_no_backedge_b18",
    "options": [
      "不能，缺少反复判断与回边",
      "能，读一次温度就够",
      "能，制冷会自己永远转",
      "不能，因为少写了「开始」"
    ]
  },
  {
    "id": "C05",
    "tier": "challenge",
    "type": "blocks_assemble",
    "platform": "编程猫Kitten",
    "stem": "用积木表示「重复观察，直到绿灯亮」。`重复执行直到` 的条件格应放？",
    "fixedBlocks": [
      "当开始被点击",
      "重复执行直到〈　〉"
    ],
    "cards": [
      "绿灯亮起",
      "绿灯未亮",
      "过马路",
      "重复执行 (10) 次",
      "如果〈　〉否则"
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
    "diagramRef": "whole_sequence_looped",
    "options": [
      "只把「观察等待」拆成带回边的反复，过街与对面留在循环外",
      "全部删掉只留菱形",
      "改成天桥分支",
      "把次数写成100"
    ]
  }
];

export function getStudentQuestions(): QuestionClient[] {
  return STUDENT_QUESTIONS.map(q => ({ ...q }));
}
