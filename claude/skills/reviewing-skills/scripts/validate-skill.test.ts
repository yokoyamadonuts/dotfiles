import { assertEquals } from "jsr:@std/assert";
import {
  checkBody,
  checkDescription,
  checkName,
  parseFrontmatter,
} from "./validate-skill.ts";

Deno.test("parseFrontmatter: extracts object frontmatter and body", () => {
  const r = parseFrontmatter(
    "---\nname: foo\ndescription: bar\n---\n# Body\ntext",
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.frontmatter.name, "foo");
    assertEquals(r.body, "# Body\ntext");
  }
});

Deno.test("parseFrontmatter: missing block fails", () => {
  const r = parseFrontmatter("# No frontmatter\njust text");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: invalid YAML fails", () => {
  const r = parseFrontmatter("---\nname: : :\n  - broken\n---\n");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: non-object frontmatter fails", () => {
  const r = parseFrontmatter("---\n- just\n- a\n- list\n---\nbody");
  assertEquals(r.ok, false);
});

Deno.test("checkName: valid flat name passes", () => {
  assertEquals(checkName("pptx"), []);
  assertEquals(checkName("competitive-research"), []);
});

Deno.test("checkName: missing/empty is Critical", () => {
  assertEquals(checkName(undefined)[0].severity, "Critical");
  assertEquals(checkName("")[0].severity, "Critical");
});

Deno.test("checkName: bad chars are Critical", () => {
  const v = checkName("Foo_Bar");
  assertEquals(v.some((x) => x.severity === "Critical"), true);
});

Deno.test("checkName: reserved word is Critical", () => {
  const v = checkName("claude-helper");
  assertEquals(v.some((x) => x.detail.includes("claude")), true);
});

Deno.test("checkName: over 64 chars is Critical", () => {
  const v = checkName("a".repeat(65));
  assertEquals(v.some((x) => x.severity === "Critical"), true);
});

Deno.test("checkName: vague name is Warning", () => {
  const v = checkName("utils");
  assertEquals(v.length, 1);
  assertEquals(v[0].severity, "Warning");
});

Deno.test("checkDescription: valid passes", () => {
  assertEquals(checkDescription("Does X. Use when Y."), []);
});

Deno.test("checkDescription: empty is Critical", () => {
  assertEquals(checkDescription("   ")[0].severity, "Critical");
  assertEquals(checkDescription(undefined)[0].severity, "Critical");
});

Deno.test("checkDescription: over 1024 chars is Critical", () => {
  assertEquals(checkDescription("x".repeat(1025))[0].severity, "Critical");
});

Deno.test("checkBody: short clean body passes", () => {
  assertEquals(checkBody("# Title\nsome steps"), []);
});

Deno.test("checkBody: over 500 lines is Warning", () => {
  const v = checkBody("x\n".repeat(501));
  assertEquals(v.some((x) => x.check.startsWith("W1")), true);
  assertEquals(v.every((x) => x.severity === "Warning"), true);
});

Deno.test("checkBody: 'When to Use' heading is Warning", () => {
  const v = checkBody("# Skill\n## When to Use This Skill\ntext");
  assertEquals(v.some((x) => x.check.startsWith("W3")), true);
});
