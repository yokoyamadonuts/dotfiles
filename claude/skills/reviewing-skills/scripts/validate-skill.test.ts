import { assertEquals } from "jsr:@std/assert";
import {
  checkBody,
  checkDescription,
  checkName,
  defaultHasTests,
  defaultRunTests,
  formatResult,
  hasCritical,
  parseFrontmatter,
  validateContent,
  validateSkill,
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

const VALID_SKILL =
  "---\nname: demo-skill\ndescription: Does a demo. Use when demoing.\n---\n# Demo\nsteps here";

Deno.test("validateContent: valid skill has no violations", () => {
  assertEquals(validateContent(VALID_SKILL), []);
});

Deno.test("validateContent: no frontmatter => single C1 Critical", () => {
  const v = validateContent("# just a body");
  assertEquals(v.length, 1);
  assertEquals(v[0].check.startsWith("C1"), true);
});

Deno.test("validateContent: aggregates name + description violations", () => {
  const v = validateContent("---\nname: Bad_Name\ndescription: ''\n---\nbody");
  assertEquals(v.some((x) => x.check.startsWith("C2")), true);
  assertEquals(v.some((x) => x.check.startsWith("C3")), true);
});

Deno.test("hasCritical: true only when a Critical exists", () => {
  assertEquals(
    hasCritical([{ severity: "Warning", check: "W1 body", detail: "x" }]),
    false,
  );
  assertEquals(
    hasCritical([{ severity: "Critical", check: "C1", detail: "x" }]),
    true,
  );
  assertEquals(hasCritical([]), false);
});

Deno.test("formatResult: PASS with no critical, lists violations", () => {
  const out = formatResult({
    skill: "demo",
    violations: [{
      severity: "Warning",
      check: "W1 body",
      detail: "612 lines (>500)",
    }],
    scriptTests: { ran: false, passed: true, output: "" },
  });
  assertEquals(out.includes("demo: PASS"), true);
  assertEquals(out.includes("[Warning] W1 body: 612 lines (>500)"), true);
});

Deno.test("formatResult: FAIL when a Critical exists", () => {
  const out = formatResult({
    skill: "demo",
    violations: [{
      severity: "Critical",
      check: "C1 frontmatter",
      detail: "no YAML frontmatter block found",
    }],
    scriptTests: { ran: false, passed: true, output: "" },
  });
  assertEquals(out.includes("demo: FAIL"), true);
});

const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("validateSkill: clean skill, no scripts => PASS, tests not run", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(false),
  });
  assertEquals(hasCritical(r.violations), false);
  assertEquals(r.scriptTests.ran, false);
});

Deno.test("validateSkill: passing scripts => no C4", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(true),
    runTests: () => Promise.resolve({ passed: true, output: "ok" }),
  });
  assertEquals(r.scriptTests.ran, true);
  assertEquals(r.violations.some((x) => x.check.startsWith("C4")), false);
});

Deno.test("validateSkill: failing scripts => C4 Critical", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(true),
    runTests: () => Promise.resolve({ passed: false, output: "boom" }),
  });
  assertEquals(r.violations.some((x) => x.check.startsWith("C4")), true);
  assertEquals(hasCritical(r.violations), true);
});

Deno.test("defaultHasTests: detects scripts/*.test.ts", async () => {
  assertEquals(await defaultHasTests(`${FIXTURES}/passing-script`), true);
});

Deno.test("defaultHasTests: false when no scripts dir", async () => {
  assertEquals(await defaultHasTests("/nonexistent/skill"), false);
});

Deno.test("defaultRunTests: passing fixture => passed true", async () => {
  const r = await defaultRunTests(`${FIXTURES}/passing-script`);
  assertEquals(r.passed, true);
});

Deno.test("defaultRunTests: failing fixture => passed false", async () => {
  const r = await defaultRunTests(`${FIXTURES}/failing-script`);
  assertEquals(r.passed, false);
});

Deno.test("validateSkill: bad content + failing scripts => C1 and C4", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve("# No frontmatter"),
    hasTests: () => Promise.resolve(true),
    runTests: () => Promise.resolve({ passed: false, output: "boom" }),
  });
  assertEquals(r.violations.some((x) => x.check.startsWith("C1")), true);
  assertEquals(r.violations.some((x) => x.check.startsWith("C4")), true);
});
