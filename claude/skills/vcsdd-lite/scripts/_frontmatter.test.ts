import { assertEquals, assertThrows } from "jsr:@std/assert";
import { extractFrontmatter, FrontmatterError } from "./_frontmatter.ts";

Deno.test("extractFrontmatter: valid spec frontmatter", () => {
  const content = `---
id: spec:auth-flow
type: spec
feature: user-auth
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
---
# Body content
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.id, "spec:auth-flow");
  assertEquals(result?.type, "spec");
  assertEquals(result?.feature, "user-auth");
  assertEquals(result?.coherence?.depends_on, ["design:user-schema"]);
  assertEquals(result?.coherence?.satisfies, ["req:user-login"]);
});

Deno.test("extractFrontmatter: returns null when no frontmatter", () => {
  const result = extractFrontmatter("# No frontmatter here\n", "test.md");
  assertEquals(result, null);
});

Deno.test("extractFrontmatter: throws on invalid YAML", () => {
  const content = `---
id: spec:bad
type: [unclosed
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Invalid YAML",
  );
});

Deno.test("extractFrontmatter: throws when id missing", () => {
  const content = `---
type: spec
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'id'",
  );
});

Deno.test("extractFrontmatter: throws when type missing", () => {
  const content = `---
id: spec:bad
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'type'",
  );
});

Deno.test("extractFrontmatter: throws when feature missing", () => {
  const content = `---
id: spec:bad
type: spec
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'feature'",
  );
});

Deno.test("extractFrontmatter: throws on invalid type value", () => {
  const content = `---
id: spec:bad
type: notarealtype
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Invalid type",
  );
});

Deno.test("extractFrontmatter: accepts minimal valid frontmatter", () => {
  const content = `---
id: req:minimal
type: req
feature: user-auth
---
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.id, "req:minimal");
  assertEquals(result?.coherence, undefined);
});

Deno.test("extractFrontmatter: preserves optional fields", () => {
  const content = `---
id: spec:full
type: spec
feature: user-auth
confidence: green
status: reviewed
last_reviewed: 2026-05-19
---
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.confidence, "green");
  assertEquals(result?.status, "reviewed");
  assertEquals(result?.last_reviewed, "2026-05-19");
});
