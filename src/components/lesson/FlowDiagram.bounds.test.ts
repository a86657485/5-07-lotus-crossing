import assert from 'node:assert/strict';
import test from 'node:test';
import type { DiagramEdge, DiagramNode } from './FlowDiagram';
import { diagramContentBounds } from './diagramBounds';

const node = (id: string, kind: DiagramNode['kind'], x: number, y: number): DiagramNode => ({ id, label: id, kind, x, y });
const edge = (id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge => ({ id, from, to, ...extra });

test('crossing-style figure expands left for the back edge and right for 否', () => {
  const nodes = [
    node('arrive', 'start', 90, 0),
    node('observe', 'process', 90, 78),
    node('condition', 'decision', 70, 156),
    node('cross', 'process', 90, 292),
    node('opposite', 'start', 90, 370),
  ];
  const edges = [
    edge('a', 'arrive', 'observe'),
    edge('b', 'observe', 'condition'),
    edge('yes', 'condition', 'observe', { branch: 'yes', back: true, label: '是' }),
    edge('no', 'condition', 'cross', { branch: 'no', label: '否' }),
    edge('c', 'cross', 'opposite'),
  ];
  const nodeOnly = { minX: 70, maxX: 70 + 240 };
  const bounds = diagramContentBounds(nodes, edges);
  assert.ok(bounds.x <= nodeOnly.minX - 80 - 16 + 1e-6, `left ${bounds.x} should be at least 80px past the decision`);
  assert.ok(bounds.x + bounds.width >= nodeOnly.maxX + 56 + 16 - 1e-6, `right should include the 否 label`);
});

test('wide branch figure does not add a large extra left margin when it already spans farther', () => {
  const nodes = [
    node('arrive', 'start', 110, 0),
    node('condition', 'decision', 90, 93),
    node('bridge', 'process', -30, 253),
    node('wait', 'process', 250, 253),
    node('continue', 'start', 110, 370),
  ];
  const edges = [
    edge('a', 'arrive', 'condition'),
    edge('yes', 'condition', 'bridge', { branch: 'yes', label: '是' }),
    edge('no', 'condition', 'wait', { branch: 'no', label: '否' }),
    edge('b', 'bridge', 'continue'),
    edge('c', 'wait', 'continue'),
  ];
  const bounds = diagramContentBounds(nodes, edges);
  // Leftmost node is already at -30; no back edge, so we only add the 16px pad.
  assert.equal(bounds.x, -30 - 16);
  // Rightmost node wait is at 250+200=450; 否 only needs 90+240+56=386, already inside.
  assert.equal(bounds.x + bounds.width, 450 + 16);
});
