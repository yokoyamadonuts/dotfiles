import { assertEquals } from "jsr:@std/assert";
import {
  buildOutput,
  loadMemoryContext,
  MAX_INJECT_LINES,
  memoryPath,
  truncate,
} from "./skill-memory.ts";

Deno.test("memoryPath: repo-local skill resolves under ~/.claude/skills", () => {
  assertEquals(
    memoryPath("pptx", "/home/u"),
    "/home/u/.claude/skills/pptx/.memory.md",
  );
});

Deno.test("memoryPath: plugin-namespaced skill returns null", () => {
  assertEquals(memoryPath("superpowers:brainstorming", "/home/u"), null);
});

Deno.test("memoryPath: empty skill returns null", () => {
  assertEquals(memoryPath("", "/home/u"), null);
});

Deno.test("truncate: text within limit is unchanged", () => {
  assertEquals(
    truncate("a\nb\nc", MAX_INJECT_LINES, "/p/.memory.md"),
    "a\nb\nc",
  );
});

Deno.test("truncate: text at the line limit is unchanged", () => {
  const atLimit = Array.from(
    { length: MAX_INJECT_LINES },
    (_, i) => `L${i}`,
  ).join("\n");
  assertEquals(truncate(atLimit, MAX_INJECT_LINES, "/p/.memory.md"), atLimit);
});

Deno.test("truncate: oversized text is capped with a marker", () => {
  const text = Array.from({ length: 250 }, (_, i) => `L${i}`).join("\n");
  const out = truncate(text, MAX_INJECT_LINES, "/p/.memory.md");
  const lines = out.split("\n");
  assertEquals(lines[0], "L0");
  assertEquals(lines[MAX_INJECT_LINES - 1], `L${MAX_INJECT_LINES - 1}`);
  assertEquals(out.includes("(truncated; full memory at /p/.memory.md)"), true);
});

Deno.test("loadMemoryContext: returns formatted context for existing memory", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("## Tips\n- resize images to 1280px"),
  });
  assertEquals(ctx?.includes("Skill memory: pptx"), true);
  assertEquals(ctx?.includes("- resize images to 1280px"), true);
  assertEquals(ctx?.includes("Apply any relevant"), true);
});

Deno.test("loadMemoryContext: missing file fails open (null)", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.reject(new Deno.errors.NotFound("nope")),
  });
  assertEquals(ctx, null);
});

Deno.test("loadMemoryContext: plugin-namespaced skill no-ops (null)", async () => {
  const ctx = await loadMemoryContext("anthropic-skills:docx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("must not be read"),
  });
  assertEquals(ctx, null);
});

Deno.test("loadMemoryContext: whitespace-only memory returns null", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("   \n  \n"),
  });
  assertEquals(ctx, null);
});

Deno.test("buildOutput: produces PostToolUse additionalContext JSON", () => {
  const json = JSON.parse(buildOutput("hello"));
  assertEquals(json.hookSpecificOutput.hookEventName, "PostToolUse");
  assertEquals(json.hookSpecificOutput.additionalContext, "hello");
  assertEquals(json.suppressOutput, true);
});
