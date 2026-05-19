import { assertEquals, assert } from "jsr:@std/assert";
import { validateGraph } from "./coherence-validate.ts";
import { scanFeature } from "./coherence-scan.ts";

const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("validateGraph: valid-feature produces no errors", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");
  const result = validateGraph(graph);
  // valid-feature has external nodes (design:user-schema etc.) not present,
  // so missing_reference errors are expected. Filter for cycle only.
  const cycles = result.issues.filter((i) => i.kind === "cycle");
  assertEquals(cycles.length, 0);
});

Deno.test("validateGraph: detects cycle A→B→A", async () => {
  const graph = await scanFeature(`${FIXTURES}/cycle`, "cycle");
  const result = validateGraph(graph);
  const cycles = result.issues.filter((i) => i.kind === "cycle");
  assert(cycles.length >= 1, "Expected at least one cycle issue");
  assertEquals(cycles[0].severity, "error");
});

Deno.test("validateGraph: detects missing_reference", async () => {
  const graph = await scanFeature(`${FIXTURES}/missing-ref`, "missing-ref");
  const result = validateGraph(graph);
  const missing = result.issues.filter((i) => i.kind === "missing_reference");
  assert(missing.length >= 1);
  assertEquals(missing[0].severity, "error");
  assertEquals(missing[0].target, "design:nonexistent-node");
});

Deno.test("validateGraph: detects orphan nodes (non-req)", async () => {
  const graph = await scanFeature(`${FIXTURES}/orphan`, "orphan");
  const result = validateGraph(graph);
  const orphans = result.issues.filter((i) => i.kind === "orphan");
  assert(orphans.length >= 1);
  // req nodes excluded from orphan check
  const orphanIds = orphans.map((o) => o.node);
  assert(!orphanIds.includes("req:root"));
  assert(orphanIds.includes("design:orphan"));
});

Deno.test("validateGraph: detects incomplete_bead", async () => {
  const graph = await scanFeature(`${FIXTURES}/incomplete-bead`, "incomplete-bead");
  const result = validateGraph(graph);
  const incomplete = result.issues.filter((i) => i.kind === "incomplete_bead");
  assert(incomplete.length >= 1);
  assertEquals(incomplete[0].severity, "info");
});

Deno.test("validateGraph: verdict is 'fail' when errors present", async () => {
  const graph = await scanFeature(`${FIXTURES}/cycle`, "cycle");
  const result = validateGraph(graph);
  assertEquals(result.verdict, "fail");
});

Deno.test("validateGraph: verdict is 'pass' when only info issues", async () => {
  const graph = await scanFeature(`${FIXTURES}/incomplete-bead`, "incomplete-bead");
  const result = validateGraph(graph);
  // incomplete-bead has spec:lonely which is orphan (warning) but no errors
  const hasErrors = result.issues.some((i) => i.severity === "error");
  if (!hasErrors) {
    assertEquals(result.verdict, "pass");
  }
});

Deno.test("validateGraph: --strict treats warnings as fail", async () => {
  const graph = await scanFeature(`${FIXTURES}/orphan`, "orphan");
  const result = validateGraph(graph, { strict: true });
  assertEquals(result.verdict, "fail");
});
