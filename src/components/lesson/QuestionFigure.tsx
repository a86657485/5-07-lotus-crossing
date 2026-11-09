import React from 'react';
import type { QuestionClient } from '../../types';
import FlowDiagram, { type DiagramEdge, type DiagramNode } from './FlowDiagram';
import './lesson.css';
import './examFigure.css';

type Figure = { nodes: DiagramNode[]; edges: DiagramEdge[]; note?: string };
const node = (id: string, label: string, kind: DiagramNode['kind'], x: number, y: number, empty = false): DiagramNode => ({ id, label, kind, x, y, empty });
const edge = (id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge => ({ id, from, to, ...extra });

function crossing(options: { missingCondition?: boolean; missingRepeat?: boolean; missingReturn?: boolean; actionInDiamond?: boolean; returnToCross?: boolean; filledAnswer?: string } = {}): Figure {
  const nodes = [
    node('arrive', '到达路口', 'start', 90, 0),
    node('observe', options.missingRepeat ? options.filledAnswer || '待填步骤' : '原地观察红绿灯', 'process', 90, 78, !!options.missingRepeat && !options.filledAnswer),
    node('condition', options.missingCondition ? options.filledAnswer || '待填判断' : options.actionInDiamond ? '原地观察红绿灯' : '绿灯未亮？', 'decision', 70, 156, !!options.missingCondition && !options.filledAnswer),
    node('cross', '过马路', 'process', 90, 292),
    node('opposite', '到达对面', 'start', 90, 370),
  ];
  const edges = [edge('arrive_observe', 'arrive', 'observe'), edge('observe_condition', 'observe', 'condition'), edge('condition_no', 'condition', 'cross', { branch: 'no', label: '否' }), edge('cross_opposite', 'cross', 'opposite')];
  if (!options.missingReturn) edges.push(edge('condition_yes', 'condition', options.returnToCross ? 'cross' : 'observe', { branch: 'yes', back: true, label: '是' }));
  return { nodes, edges, ...(options.missingReturn ? { note: '“是”出口的箭头尚未接好。' } : {}) };
}

function bridge(): Figure {
  return {
    nodes: [node('arrive', '到达路口', 'start', 110, 0), node('condition', '有可用天桥？', 'decision', 90, 93), node('bridge', '上天桥', 'process', -30, 253), node('wait', '等灯', 'process', 250, 253), node('continue', '继续前行', 'start', 110, 370)],
    edges: [edge('arrive_condition', 'arrive', 'condition'), edge('bridge_yes', 'condition', 'bridge', { branch: 'yes', label: '是' }), edge('wait_no', 'condition', 'wait', { branch: 'no', label: '否' }), edge('bridge_continue', 'bridge', 'continue'), edge('wait_continue', 'wait', 'continue')],
  };
}

function kettle(askFirst: boolean, missingCondition = false, filledAnswer?: string): Figure {
  if (askFirst) return {
    nodes: [node('read', '读取水温', 'process', 160, 0), node('condition', missingCondition ? filledAnswer || '待填判断' : '水温低于设定？', 'decision', 140, 108, missingCondition && !filledAnswer), node('heat', '继续加热', 'process', -130, 134), node('stop', '停止加热', 'start', 160, 302)],
    edges: [edge('read_condition', 'read', 'condition'), edge('heat_yes', 'condition', 'heat', { branch: 'yes', label: '是' }), edge('heat_read', 'heat', 'read', { back: true }), edge('stop_no', 'condition', 'stop', { branch: 'no', label: '否' })],
  };
  return {
    nodes: [node('heat', '继续加热', 'process', 100, 0), node('read', '读取水温', 'process', 100, 93), node('condition', '水温低于设定？', 'decision', 80, 185), node('stop', '停止加热', 'start', 100, 342)],
    edges: [edge('heat_read', 'heat', 'read'), edge('read_condition', 'read', 'condition'), edge('repeat_yes', 'condition', 'heat', { branch: 'yes', back: true, label: '是' }), edge('stop_no', 'condition', 'stop', { branch: 'no', label: '否' })],
  };
}

function sequence(loopWhole = false): Figure {
  const nodes = [node('arrive', '到达路口', 'start', 100, 0), node('wait', '观察并等待绿灯', 'process', 100, 90), node('cross', '过马路', 'process', 100, 180), node('opposite', '到达对面', 'start', 100, 270)];
  const edges = [edge('arrive_wait', 'arrive', 'wait'), edge('wait_cross', 'wait', 'cross'), edge('cross_opposite', 'cross', 'opposite')];
  if (loopWhole) edges.push(edge('repeat_whole', 'opposite', 'arrive', { branch: 'yes', back: true }));
  return { nodes, edges };
}

function airConditioner(): Figure {
  return {
    nodes: [node('setting', '输入预期温度', 'start', 130, 0), node('read', '读取室温', 'process', 130, 78), node('condition', '室温＞预期？', 'decision', 110, 156), node('cool', '制冷运行', 'process', -30, 318), node('stop', '停止制冷', 'process', 270, 318)],
    edges: [edge('setting_read', 'setting', 'read'), edge('read_condition', 'read', 'condition'), edge('cool_yes', 'condition', 'cool', { branch: 'yes', label: '是' }), edge('stop_no', 'condition', 'stop', { branch: 'no', label: '否' }), edge('stop_read', 'stop', 'read', { back: true })],
  };
}

function singleFigure(question: QuestionClient, filledAnswer?: string): Figure | null {
  // Fill-in items render the missing part rather than the answer that belongs in it.
  if (question.id === 'B04') return crossing({ missingCondition: true, filledAnswer });
  if (question.id === 'B05') return crossing({ missingRepeat: true, filledAnswer });
  if (question.id === 'B06') return crossing({ missingReturn: true });
  if (question.id === 'B10') return kettle(true, true, filledAnswer);
  switch (question.diagramRef) {
    case 'order_no_backedge': return sequence();
    case 'branch_bridge': return bridge();
    case 'kettle_ask_first': return kettle(true);
    case 'diamond_has_action': return crossing({ actionInDiamond: true });
    case 'backedge_to_cross': return crossing({ returnToCross: true });
    case 'ac_no_backedge_b18': return airConditioner();
    case 'whole_sequence_looped': return sequence(true);
    default: return null;
  }
}

function ReadonlyFigure({ figure, title, name }: { figure: Figure; title?: string; name: string }) {
  return <div className="question-figure-card" data-figure-name={name}>
    {title && <div className="question-figure-title">{title}</div>}
    <div className="question-figure-canvas" data-readonly-diagram="true" role="img" aria-label={`${title || '题中'}流程图`}>
      <FlowDiagram nodes={figure.nodes} edges={figure.edges} label={`${title || '题中'}流程图`}/>
    </div>
    {figure.note && <p className="question-figure-note">{figure.note}</p>}
  </div>;
}

/** Assessment figures are read-only and deliberately carry no selection or correctness styles. */
export default function QuestionFigure({ question, filledAnswer }: { question: QuestionClient; filledAnswer?: string }) {
  if (question.id === 'B08' || question.id === 'C02') {
    const paired = question.id === 'B08' ? [crossing(), bridge()] : [kettle(true), kettle(false)];
    return <figure className="question-figure question-figure-double" data-question-figure={question.id} data-figure-count="2" data-diagram-ref={question.diagramRef || 'paired'}>
      <ReadonlyFigure key={`${question.id}-a`} figure={paired[0]} title={question.id === 'B08' ? '左图（甲）' : '图甲'} name={`${question.id}-a`}/>
      <ReadonlyFigure key={`${question.id}-b`} figure={paired[1]} title={question.id === 'B08' ? '右图（乙）' : '图乙'} name={`${question.id}-b`}/>
    </figure>;
  }
  const figure = singleFigure(question, filledAnswer);
  if (!figure) return null;
  return <figure className="question-figure question-figure-single" data-question-figure={question.id} data-figure-count="1" data-diagram-ref={question.diagramRef || 'incomplete'}><ReadonlyFigure key={question.id} figure={figure} name={question.id}/></figure>;
}
