import type { Edge, Node } from '@xyflow/react';

/** Match the player's entry point and keep every reachable branch and routing node. */
export function playableWebScope(nodes: Node[], edges: Edge[]) {
  const playable = nodes.filter(
    (node) =>
      (node.type === 'storyNode' || node.type === 'numberConditionNode') && !node.data?.hidden,
  );
  const byId = new Map(playable.map((node) => [node.id, node]));
  const root = playable.find((node) => node.data?.isRoot) || playable[0];
  const outgoing = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!byId.has(edge.source) || !byId.has(edge.target)) return;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
  });
  const reachable = new Set<string>();
  const queue = root ? [root.id] : [];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (reachable.has(id)) continue;
    reachable.add(id);
    queue.push(...(outgoing.get(id) || []));
  }
  return {
    nodes: playable.filter((node) => reachable.has(node.id)),
    edges: edges.filter((edge) => reachable.has(edge.source) && reachable.has(edge.target)),
  };
}
