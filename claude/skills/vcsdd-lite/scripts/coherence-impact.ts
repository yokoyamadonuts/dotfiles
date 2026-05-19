#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, NodeType } from "./_types.ts";

const CWD = Deno.cwd();

export interface AffectedNode {
  id: string;
  via: string;
  confidence: string;
}

export interface ImpactResult {
  root: string;
  max_depth: number;
  affected: Record<string, AffectedNode[]>;
  total_affected: number;
  by_type: Record<NodeType, number>;
}

export function computeImpact(
  graph: CoherenceGraph,
  rootId: string,
  maxDepth: number,
): ImpactResult {
  if (!(rootId in graph.nodes)) {
    throw new Error(`Node not found: ${rootId}`);
  }

  // Build inverse adjacency: incoming edges to each node
  const inverseAdj: Record<string, Array<{ from: string; kind: string }>> = {};
  for (const id of Object.keys(graph.nodes)) inverseAdj[id] = [];
  for (const edge of graph.edges) {
    if (edge.to in inverseAdj) {
      inverseAdj[edge.to].push({ from: edge.from, kind: edge.kind });
    }
  }

  const affected: Record<string, AffectedNode[]> = {};
  const visited = new Set<string>([rootId]);
  let queue: Array<{ id: string; via: string; depth: number }> = [];

  for (const incoming of inverseAdj[rootId]) {
    queue.push({ id: incoming.from, via: incoming.kind, depth: 1 });
  }

  while (queue.length > 0) {
    const next: typeof queue = [];
    for (const item of queue) {
      if (visited.has(item.id)) continue;
      if (item.depth > maxDepth) continue;
      visited.add(item.id);

      const key = `depth_${item.depth}`;
      if (!affected[key]) affected[key] = [];
      affected[key].push({
        id: item.id,
        via: item.via,
        confidence: graph.nodes[item.id].confidence,
      });

      for (const incoming of inverseAdj[item.id]) {
        next.push({
          id: incoming.from,
          via: `${item.id}→${incoming.kind}`,
          depth: item.depth + 1,
        });
      }
    }
    queue = next;
  }

  const allAffected = Object.values(affected).flat();
  const byType: Record<NodeType, number> = {
    req: 0, spec: 0, design: 0, test: 0, impl: 0, verify: 0,
  };
  for (const a of allAffected) {
    const t = graph.nodes[a.id].type;
    byType[t]++;
  }

  return {
    root: rootId,
    max_depth: maxDepth,
    affected,
    total_affected: allAffected.length,
    by_type: byType,
  };
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "node", "format"],
    default: { format: "json", depth: "5" },
  });

  if (!args.feature || !args.node) {
    console.error("Error: --feature <name> and --node <id> are required");
    Deno.exit(2);
  }

  const depth = parseInt(String((args as Record<string, unknown>).depth ?? "5"), 10);
  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));
  const result = computeImpact(graph, args.node, depth);

  if (args.format === "md") {
    console.log(`# Impact Analysis: ${result.root}\n`);
    console.log(`**Total affected**: ${result.total_affected} nodes\n`);
    for (const [key, nodes] of Object.entries(result.affected)) {
      const depthN = key.replace("depth_", "");
      console.log(`## Depth ${depthN}`);
      for (const n of nodes as AffectedNode[]) {
        const marker = n.confidence === "green" ? "[green]" : n.confidence === "amber" ? "[amber]" : "[gray]";
        console.log(`- ${marker} \`${n.id}\` (via ${n.via})`);
      }
      console.log();
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
