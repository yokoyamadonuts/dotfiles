#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, Issue } from "./_types.ts";

const CWD = Deno.cwd();

export interface ValidationResult {
  feature: string;
  validated_at: string;
  verdict: "pass" | "fail";
  errors: number;
  warnings: number;
  info: number;
  issues: Issue[];
}

export interface ValidateOptions {
  strict?: boolean;
}

export function validateGraph(
  graph: CoherenceGraph,
  options: ValidateOptions = {},
): ValidationResult {
  const issues: Issue[] = [];

  issues.push(...findMissingReferences(graph));
  issues.push(...findCycles(graph));
  issues.push(...findOrphans(graph));
  issues.push(...findTypeMismatches(graph));
  issues.push(...findIncompleteBeads(graph));
  issues.push(...findGrayInLockedSpecs(graph));

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;

  const verdict =
    errors > 0 || (options.strict && warnings > 0) ? "fail" : "pass";

  return {
    feature: graph.feature,
    validated_at: new Date().toISOString(),
    verdict,
    errors,
    warnings,
    info,
    issues,
  };
}

function findMissingReferences(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.to)) {
      issues.push({
        severity: "error",
        kind: "missing_reference",
        node: edge.from,
        field: edge.kind,
        target: edge.to,
        message: `Referenced node not found: ${edge.to} (from ${edge.from}.${edge.kind})`,
      });
    }
  }
  return issues;
}

function findCycles(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const adj: Record<string, string[]> = {};
  for (const id of Object.keys(graph.nodes)) adj[id] = [];
  for (const edge of graph.edges) {
    if (edge.kind === "depends_on" && edge.to in adj) {
      adj[edge.from].push(edge.to);
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      return path.slice(idx).concat(node);
    }
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of adj[node] ?? []) {
      const cycle = dfs(next);
      if (cycle) return cycle;
    }
    stack.delete(node);
    path.pop();
    return null;
  }

  for (const id of Object.keys(graph.nodes)) {
    if (!visited.has(id)) {
      const cycle = dfs(id);
      if (cycle) {
        issues.push({
          severity: "error",
          kind: "cycle",
          cycle,
          message: `Cycle detected: ${cycle.join(" → ")}`,
        });
        break;
      }
    }
  }
  return issues;
}

function findOrphans(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const inDegree: Record<string, number> = {};
  for (const id of Object.keys(graph.nodes)) inDegree[id] = 0;
  for (const edge of graph.edges) {
    if (edge.to in inDegree) inDegree[edge.to]++;
  }
  for (const [id, deg] of Object.entries(inDegree)) {
    const node = graph.nodes[id];
    if (deg === 0 && node.type !== "req") {
      issues.push({
        severity: "warning",
        kind: "orphan",
        node: id,
        message: `Node has no incoming edges: ${id}`,
      });
    }
  }
  return issues;
}

function findTypeMismatches(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const VERIFIED_BY_TARGETS = new Set(["test", "verify"]);
  for (const [id, node] of Object.entries(graph.nodes)) {
    for (const target of node.verified_by) {
      const targetNode = graph.nodes[target];
      if (!targetNode) continue;
      if (!VERIFIED_BY_TARGETS.has(targetNode.type)) {
        issues.push({
          severity: "warning",
          kind: "type_mismatch",
          node: id,
          field: "verified_by",
          target,
          message: `verified_by target must be test/verify, got ${targetNode.type}`,
        });
      }
    }
  }
  return issues;
}

function findIncompleteBeads(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const REQUIRED_TYPES = ["req", "spec", "test", "impl", "verify"] as const;
  for (const [beadId, bead] of Object.entries(graph.beads)) {
    const presentTypes: string[] = bead.members
      .map((m) => graph.nodes[m]?.type)
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
    const types = new Set(presentTypes);
    const missing = REQUIRED_TYPES.filter((t) => !types.has(t));
    if (missing.length > 0) {
      issues.push({
        severity: "info",
        kind: "incomplete_bead",
        node: beadId,
        members: [...types],
        message: `Bead missing types: ${missing.join(", ")}`,
      });
    }
  }
  return issues;
}

function findGrayInLockedSpecs(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.status === "locked" && node.confidence === "gray") {
      issues.push({
        severity: "warning",
        kind: "gray_in_locked_spec",
        node: id,
        message: `Locked node has gray confidence: ${id}`,
      });
    }
  }
  return issues;
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "format"],
    boolean: ["strict"],
    default: { format: "json" },
  });

  if (!args.feature) {
    console.error("Error: --feature <name> is required");
    Deno.exit(2);
  }

  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));
  const result = validateGraph(graph, { strict: args.strict });

  if (args.format === "md") {
    console.log(`# Coherence Validation: ${result.feature}\n`);
    console.log(`**Verdict**: ${result.verdict === "pass" ? "PASS" : "FAIL"} (${result.errors} errors, ${result.warnings} warnings, ${result.info} info)\n`);
    for (const sev of ["error", "warning", "info"] as const) {
      const filtered = result.issues.filter((i) => i.severity === sev);
      if (filtered.length === 0) continue;
      console.log(`## ${sev[0].toUpperCase()}${sev.slice(1)}s`);
      for (const issue of filtered) {
        console.log(`- \`${issue.kind}\` ${issue.message}`);
      }
      console.log();
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (result.verdict === "fail") Deno.exit(1);
}
