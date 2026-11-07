import React, { useEffect, useMemo, useRef } from 'react';
import { BaseEdge, Handle, MarkerType, Position, ReactFlow, getSmoothStepPath, type EdgeProps, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export type DiagramNode = { id: string; label: string; kind: 'start' | 'process' | 'decision'; x: number; y: number; empty?: boolean; branches?: boolean };
export type DiagramEdge = { id: string; from: string; to: string; branch?: 'yes' | 'no'; label?: string; back?: boolean };
type Props = { nodes: DiagramNode[]; edges: DiagramEdge[]; activeNode?: string; nextNodeId?: string; selectedEdge?: string; selectedBranch?: string; onNodeSelect?: (id: string) => void; onPortSelect?: (port: 'yes' | 'no') => void; onEdgeSelect?: (id: string) => void; label?: string };

function LessonNode({ data }: NodeProps) {
  const d = data as any;
  return <div className={`lesson-node ${d.kind} ${d.empty ? 'empty' : ''} ${d.active ? 'executing' : ''} ${d.selectable ? 'can-select' : ''}`} data-node-id={d.id}>
    <Handle type="target" position={Position.Top} id="top" />
    <Handle type="target" position={Position.Left} id="left" />
    <svg className="node-shape" viewBox={d.kind === 'decision' ? '0 0 240 100' : '0 0 200 54'} preserveAspectRatio="none" aria-hidden="true">
      {d.kind === 'decision' ? <path d="M120 4 Q122 4 127 7 L231 45 Q241 50 231 55 L127 93 Q120 97 113 93 L9 55 Q-1 50 9 45 L113 7 Q118 4 120 4Z" /> : <rect x="3" y="3" width="194" height="48" rx={d.kind === 'start' ? 25 : 14} />}
    </svg>
    <span className="node-label">{d.label}</span>
    {d.branches && <>
      <button className={`branch-port yes ${d.selectedBranch === 'yes' ? 'chosen' : ''}`} onClick={e => { e.stopPropagation(); d.onPort?.('yes'); }} aria-label="连接是的箭头">是</button>
      <button className={`branch-port no ${d.selectedBranch === 'no' ? 'chosen' : ''}`} onClick={e => { e.stopPropagation(); d.onPort?.('no'); }} aria-label="连接否的箭头">否</button>
    </>}
    <Handle type="source" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Left} id="yes" />
    <Handle type="source" position={Position.Right} id="no" />
  </div>;
}

function LessonEdge(props: EdgeProps) {
  const back = !!props.data?.back;
  const selected = !!props.data?.selected;
  let path: string;
  if (back) {
    const x = Math.min(props.sourceX, props.targetX) - 52;
    const top = props.targetY;
    path = `M${props.sourceX},${props.sourceY} H${x + 14} Q${x},${props.sourceY} ${x},${props.sourceY - 14} V${top + 14} Q${x},${top} ${x + 14},${top} H${props.targetX}`;
  } else {
    [path] = getSmoothStepPath({ sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY, sourcePosition: props.sourcePosition, targetPosition: props.targetPosition, borderRadius: 20, offset: 26 });
  }
  return <g className={selected ? 'diagram-edge selected' : 'diagram-edge'}>
    <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={{ stroke: selected ? '#f58b20' : '#367abd', strokeWidth: selected ? 4.5 : 3 }} interactionWidth={30} />
    {props.label && <text x={back ? Math.min(props.sourceX, props.targetX) - 68 : props.sourceX + 18} y={back ? (props.sourceY + props.targetY) / 2 : props.sourceY - 8} className="edge-word">{props.label}</text>}
  </g>;
}

const nodeTypes = { lesson: LessonNode };
const edgeTypes = { lesson: LessonEdge };

export default function FlowDiagram(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const fit = useRef<() => void>(() => {});
  const layoutKey = props.nodes.map(n => `${n.id}:${n.kind}:${n.x}:${n.y}`).join('|');
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => fit.current());
    });
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    let secondFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => fit.current());
    });
    return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(secondFrame); };
  }, [layoutKey]);
  const nodes = useMemo(() => props.nodes.map(n => ({ id: n.id, type: 'lesson', position: { x: n.x, y: n.y }, data: { ...n, active: props.activeNode === n.id, selectable: !!props.onNodeSelect, selectedBranch: props.selectedBranch, onPort: props.onPortSelect }, width: n.kind === 'decision' ? 240 : 200, height: n.kind === 'decision' ? 100 : 54, draggable: false })), [props.nodes, props.activeNode, props.onNodeSelect, props.onPortSelect, props.selectedBranch]);
  const edges = useMemo(() => props.edges.map(e => ({ id: e.id, type: 'lesson', source: e.from, target: e.to, sourceHandle: e.branch || 'bottom', targetHandle: e.back ? 'left' : 'top', label: e.label, markerEnd: { type: MarkerType.ArrowClosed, color: props.selectedEdge === e.id ? '#f58b20' : '#367abd' }, data: { back: e.back, selected: props.selectedEdge === e.id }, animated: props.activeNode === e.from && props.nextNodeId === e.to })), [props.edges, props.selectedEdge, props.activeNode, props.nextNodeId]);
  return <div ref={container} className="lesson-flow" aria-label={props.label || '可操作流程图'}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={instance => { fit.current = () => { void instance.fitView({ padding: .18, duration: 0 }); }; fit.current(); }} fitView fitViewOptions={{ padding: .18 }} minZoom={.25} maxZoom={1.1} nodesDraggable={false} nodesConnectable={false} panOnDrag={false} panOnScroll={false} zoomOnScroll={false} zoomOnDoubleClick={false} zoomOnPinch={false} elementsSelectable={false} onNodeClick={(_, node) => props.onNodeSelect?.(node.id)} onEdgeClick={(_, edge) => props.onEdgeSelect?.(edge.id)} preventScrolling={false} />
  </div>;
}
