import { assertEquals, assert } from "jsr:@std/assert";
import { computeImpact } from "./coherence-impact.ts";
import type { CoherenceGraph } from "./_types.ts";

function makeGraph(): CoherenceGraph {
  return {
    $schema: "vcsdd-lite-coherence-v1",
    version: "1.0",
    feature: "test",
    scanned_at: "2026-05-19T00:00:00Z",
    scanner_version: "vcsdd-lite/0.1",
    mode: "lean",
    nodes: {
      "design:schema":    { type: "design", path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "spec:flow":        { type: "spec",   path: "p", confidence: "green", depends_on: ["design:schema"], satisfies: ["req:root"], verified_by: ["test:flow"], beads: [] },
      "test:flow":        { type: "test",   path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "req:root":         { type: "req",    path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "impl:service":     { type: "impl",   path: "p", confidence: "green", depends_on: ["spec:flow"], satisfies: [],            verified_by: [],            beads: [] },
    },
    edges: [
      { from: "spec:flow",    to: "design:schema", kind: "depends_on" },
      { from: "spec:flow",    to: "req:root",      kind: "satisfies" },
      { from: "spec:flow",    to: "test:flow",     kind: "verified_by" },
      { from: "impl:service", to: "spec:flow",     kind: "depends_on" },
    ],
    beads: {},
    issues: [],
    summary: { total_nodes: 5, confidence_distribution: { green: 5, amber: 0, gray: 0 }, cycles_detected: 0, missing_references: 0, orphans: 0 },
  };
}

Deno.test("computeImpact: design:schema affects spec:flow at depth 1", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  assertEquals(result.root, "design:schema");
  assert(result.affected.depth_1.some((a) => a.id === "spec:flow"));
});

Deno.test("computeImpact: propagates to depth 2", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  // depth_1: spec:flow
  // depth_2: impl:service (depends_on spec:flow)
  assert(result.affected.depth_2?.some((a) => a.id === "impl:service"));
});

Deno.test("computeImpact: respects max depth", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 1);

  assert(result.affected.depth_1.length > 0);
  assertEquals(result.affected.depth_2, undefined);
});

Deno.test("computeImpact: throws on unknown node", () => {
  const graph = makeGraph();
  let threw = false;
  try {
    computeImpact(graph, "spec:nonexistent", 5);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("not found"));
  }
  assert(threw);
});

Deno.test("computeImpact: by_type aggregates correctly", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  assert(result.by_type.spec >= 1);
  assert(result.by_type.impl >= 1);
});

Deno.test("computeImpact: no self-loop in result", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  const allIds: string[] = [];
  for (const depthArr of Object.values(result.affected)) {
    if (Array.isArray(depthArr)) allIds.push(...depthArr.map((a) => a.id));
  }
  assert(!allIds.includes("design:schema"));
});
