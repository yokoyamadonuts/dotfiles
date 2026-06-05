import { assertEquals } from "jsr:@std/assert";
import { MAX_INJECT_LINES, memoryPath, truncate } from "./skill-memory.ts";

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
