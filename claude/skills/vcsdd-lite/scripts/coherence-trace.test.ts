import { assertEquals, assert } from "jsr:@std/assert";
import { traceReq } from "./coherence-trace.ts";
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
      "req:login":      { type: "req",    path: "p", confidence: "green", depends_on: [],                satisfies: [],            verified_by: [],            beads: ["bead:B-1"] },
      "spec:login":     { type: "spec",   path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: ["test:login"], beads: ["bead:B-1"] },
      "test:login":     { type: "test",   path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
      "impl:login":     { type: "impl",   path: "p", confidence: "green", depends_on: ["spec:login"],    satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
      "verify:login":   { type: "verify", path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
    },
    edges: [],
    beads: { "bead:B-1": { members: ["req:login","spec:login","test:login","impl:login","verify:login"], completeness: "full" } },
    issues: [],
    summary: { total_nodes: 5, confidence_distribution: { green: 5, amber: 0, gray: 0 }, cycles_detected: 0, missing_references: 0, orphans: 0 },
  };
}

Deno.test("traceReq: full trace for complete req", () => {
  const graph = makeGraph();
  const result = traceReq(graph, "req:login");

  assertEquals(result.req, "req:login");
  assertEquals(result.specs.length, 1);
  assertEquals(result.tests.length, 1);
  assertEquals(result.impls.length, 1);
  assertEquals(result.verifies.length, 1);
  assertEquals(result.completeness_percent, 100);
});

Deno.test("traceReq: detects missing verification dimension", () => {
  const graph = makeGraph();
  delete graph.nodes["verify:login"];

  const result = traceReq(graph, "req:login");
  assertEquals(result.verifies.length, 0);
  assert(result.completeness_percent < 100);
  assert(result.missing.includes("verify"));
});

Deno.test("traceReq: throws on unknown req", () => {
  const graph = makeGraph();
  let threw = false;
  try {
    traceReq(graph, "req:nonexistent");
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("not found"));
  }
  assert(threw);
});

Deno.test("traceReq: only spec=>req via satisfies", () => {
  const graph = makeGraph();
  // Remove satisfies link from impl
  graph.nodes["impl:login"].satisfies = [];

  const result = traceReq(graph, "req:login");
  assertEquals(result.impls.length, 0);
});
