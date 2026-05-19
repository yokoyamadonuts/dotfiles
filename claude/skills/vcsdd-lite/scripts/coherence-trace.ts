#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, NodeType } from "./_types.ts";

const CWD = Deno.cwd();

export interface TraceResult {
  req: string;
  specs: string[];
  tests: string[];
  impls: string[];
  verifies: string[];
  missing: NodeType[];
  completeness_percent: number;
}

export function traceReq(graph: CoherenceGraph, reqId: string): TraceResult {
  if (!(reqId in graph.nodes)) {
    throw new Error(`Requirement not found: ${reqId}`);
  }

  const specs: string[] = [];
  const tests: string[] = [];
  const impls: string[] = [];
  const verifies: string[] = [];

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!node.satisfies.includes(reqId)) continue;
    switch (node.type) {
      case "spec":   specs.push(id);    break;
      case "test":   tests.push(id);    break;
      case "impl":   impls.push(id);    break;
      case "verify": verifies.push(id); break;
    }
  }

  const dims: Array<[NodeType, string[]]> = [
    ["spec", specs],
    ["test", tests],
    ["impl", impls],
    ["verify", verifies],
  ];
  const present = dims.filter(([, arr]) => arr.length > 0).length;
  const missing = dims.filter(([, arr]) => arr.length === 0).map(([t]) => t);

  return {
    req: reqId,
    specs,
    tests,
    impls,
    verifies,
    missing,
    completeness_percent: Math.round((present / 4) * 100),
  };
}

function formatMarkdown(result: TraceResult, graph: CoherenceGraph): string {
  const lines: string[] = [];
  lines.push(`# Traceability: ${result.req}\n`);

  const sections: Array<[string, string[], string]> = [
    ["Specification", result.specs, "spec"],
    ["Tests",         result.tests, "test"],
    ["Implementation", result.impls, "impl"],
    ["Verification",  result.verifies, "verify"],
  ];
  for (const [title, ids, kind] of sections) {
    const status = ids.length > 0 ? `[ok] ${title}` : `[missing] ${title}`;
    lines.push(`## ${status}`);
    if (ids.length === 0) {
      lines.push(`_(missing ${kind})_`);
    } else {
      for (const id of ids) {
        lines.push(`- \`${id}\` -> ${graph.nodes[id].path}`);
      }
    }
    lines.push("");
  }
  lines.push(`## Completeness: ${result.completeness_percent}% (${4 - result.missing.length}/4 dimensions covered)`);
  return lines.join("\n");
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "req", "bead", "format"],
    default: { format: "md" },
  });

  if (!args.feature || (!args.req && !args.bead)) {
    console.error("Error: --feature <name> and either --req or --bead is required");
    Deno.exit(2);
  }

  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));

  if (args.req) {
    const result = traceReq(graph, args.req);
    if (args.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatMarkdown(result, graph));
    }
  } else if (args.bead) {
    const bead = graph.beads[args.bead];
    if (!bead) {
      console.error(`Bead not found: ${args.bead}`);
      Deno.exit(2);
    }
    if (args.format === "json") {
      console.log(JSON.stringify({ bead: args.bead, ...bead }, null, 2));
    } else {
      console.log(`# Bead: ${args.bead}\n`);
      console.log(`**Completeness**: ${bead.completeness}\n`);
      console.log(`## Members`);
      for (const id of bead.members) {
        console.log(`- \`${id}\` (${graph.nodes[id]?.type ?? "unknown"})`);
      }
    }
  }
}
