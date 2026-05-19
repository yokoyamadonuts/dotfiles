import { assertEquals, assert } from "jsr:@std/assert";
import { scanFeature } from "./coherence-scan.ts";

const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("scanFeature: valid-feature builds correct graph", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assertEquals(graph.feature, "valid-feature");
  assertEquals(Object.keys(graph.nodes).length, 2);
  assert("spec:auth-flow" in graph.nodes);
  assert("spec:session-mgmt" in graph.nodes);

  const authFlow = graph.nodes["spec:auth-flow"];
  assertEquals(authFlow.type, "spec");
  assertEquals(authFlow.depends_on, ["design:user-schema"]);
  assertEquals(authFlow.satisfies, ["req:user-login"]);
  assertEquals(authFlow.beads, ["bead:B-001-login"]);
});

Deno.test("scanFeature: generates edges for all coherence relations", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  // 2 specs × 3 relations (depends_on/satisfies/verified_by) = 6 edges
  assertEquals(graph.edges.length, 6);

  // Check at least one of each kind exists
  const kinds = new Set(graph.edges.map((e) => e.kind));
  assert(kinds.has("depends_on"));
  assert(kinds.has("satisfies"));
  assert(kinds.has("verified_by"));
});

Deno.test("scanFeature: collects beads with member sets", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assert("bead:B-001-login" in graph.beads);
  const bead = graph.beads["bead:B-001-login"];
  assertEquals(bead.members.includes("spec:auth-flow"), true);
});

Deno.test("scanFeature: respects manual confidence override", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  // Both specs have confidence: green in their frontmatter
  assertEquals(graph.nodes["spec:auth-flow"].confidence, "green");
  assertEquals(graph.nodes["spec:session-mgmt"].confidence, "green");
});

Deno.test("scanFeature: throws on duplicate node id", async () => {
  const tmpDir = await Deno.makeTempDir();
  const specs = `${tmpDir}/specs`;
  await Deno.mkdir(specs, { recursive: true });
  const dupFrontmatter = `---
id: spec:dup
type: spec
feature: dup
---
`;
  await Deno.writeTextFile(`${specs}/a.md`, dupFrontmatter);
  await Deno.writeTextFile(`${specs}/b.md`, dupFrontmatter);

  try {
    let threw = false;
    try {
      await scanFeature(tmpDir, "dup");
    } catch (e) {
      threw = true;
      assert((e as Error).message.includes("Duplicate"));
    }
    assert(threw, "Expected scanFeature to throw on duplicate id");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("scanFeature: summary counts are accurate", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assertEquals(graph.summary.total_nodes, 2);
  assertEquals(graph.summary.confidence_distribution.green, 2);
  assertEquals(graph.summary.confidence_distribution.amber, 0);
  assertEquals(graph.summary.confidence_distribution.gray, 0);
});
