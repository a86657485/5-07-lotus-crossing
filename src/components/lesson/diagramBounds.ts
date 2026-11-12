import type { DiagramEdge, DiagramNode } from './FlowDiagram';

const nodeSize = (kind: DiagramNode['kind']) => kind === 'decision' ? { w: 240, h: 100 } : { w: 200, h: 54 };

function handleX(node: DiagramNode, handle: string) {
  const w = nodeSize(node.kind).w;
  if (handle === 'yes' || handle === 'left') return node.x;
  if (handle === 'no') return node.x + w;
  return node.x + w / 2;
}

/** Node box plus back-edge swing, branch labels, and a little inset so rounded cards do not clip them. */
export function diagramContentBounds(nodes: DiagramNode[], edges: DiagramEdge[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };
  const byId = new Map(nodes.map(node => [node.id, node]));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const { w, h } = nodeSize(node.kind);
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + w);
    maxY = Math.max(maxY, node.y + h);
    if (node.branches && node.kind === 'decision') {
      minX = Math.min(minX, node.x - 47);
      maxX = Math.max(maxX, node.x + w + 47);
    }
  }
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    if (edge.back) {
      const left = Math.min(handleX(from, edge.branch || 'bottom'), handleX(to, 'left'));
      // Path swings 52px left; the「是」label sits at left-68. Keep ~80px so stroke and card radius stay clear.
      minX = Math.min(minX, left - 80);
    } else if (edge.branch === 'no' && edge.label) {
      const right = handleX(from, 'no');
      // Label is drawn at sourceX+18; leave room for the character, stroke, and the smooth-step bulge.
      maxX = Math.max(maxX, right + 56);
    }
  }
  const pad = 16;
  return { x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 };
}
