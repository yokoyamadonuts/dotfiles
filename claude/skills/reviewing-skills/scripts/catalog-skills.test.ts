import { assertEquals } from "jsr:@std/assert";
import { extractKeywords, findOverlaps } from "./catalog-skills.ts";

Deno.test("extractKeywords: latin >=4 and katakana runs, minus stopwords", () => {
  const kw = extractKeywords(
    "design-intent",
    "A design skill. デザイン意図をレビュー。",
  );
  assertEquals(kw.includes("design"), true);
  assertEquals(kw.includes("intent"), true);
  assertEquals(kw.includes("デザイン"), true);
  assertEquals(kw.includes("skill"), false); // stopword
});

Deno.test("extractKeywords: drops latin shorter than 4 chars", () => {
  const kw = extractKeywords("x", "use AI now");
  assertEquals(kw.includes("use"), false); // 3 chars
  assertEquals(kw.includes("now"), false);
});

Deno.test("findOverlaps: flags pairs sharing >=2 keywords", () => {
  const o = findOverlaps([
    { name: "a", keywords: ["design", "system", "color"] },
    { name: "b", keywords: ["design", "system", "video"] },
    { name: "c", keywords: ["video", "audio"] },
  ]);
  assertEquals(o.length, 1);
  assertEquals(o[0].a, "a");
  assertEquals(o[0].b, "b");
  assertEquals([...o[0].shared].sort().join(","), "design,system");
});

Deno.test("findOverlaps: <2 shared not flagged", () => {
  const o = findOverlaps([
    { name: "a", keywords: ["design"] },
    { name: "b", keywords: ["design"] },
  ]);
  assertEquals(o.length, 0);
});
