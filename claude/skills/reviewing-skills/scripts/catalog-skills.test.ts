import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import {
  catalogEntry,
  countFailureModes,
  extractKeywords,
  findOverlaps,
  formatCatalog,
  recommend,
} from "./catalog-skills.ts";

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

Deno.test("countFailureModes: counts bullets under the heading only", () => {
  const mem = "## ⚠️ Failure Modes\n- a\n- b\n\n## 🔧 Input Quirks\n- c\n";
  assertEquals(countFailureModes(mem), 2);
});

Deno.test("countFailureModes: zero when no Failure Modes section", () => {
  assertEquals(countFailureModes("## Tips\n- x\n- y\n"), 0);
});

Deno.test("recommend: refine on any signal, ok otherwise", () => {
  assertEquals(recommend(0, 0, 0), "ok");
  assertEquals(recommend(0, 1, 0), "refine");
  assertEquals(recommend(1, 0, 0), "refine");
  assertEquals(recommend(0, 0, 3), "refine");
});

Deno.test("catalogEntry: aggregates signals via DI (memory => refine)", async () => {
  const e = await catalogEntry("/skills", "demo", {
    readTextFile: (p) => {
      const s = String(p);
      if (s.endsWith("SKILL.md")) {
        return Promise.resolve(
          "---\nname: demo\ndescription: A demo design skill. デザイン.\n---\n# Demo\nbody",
        );
      }
      if (s.endsWith(".memory.md")) {
        return Promise.resolve("## ⚠️ Failure Modes\n- a\n- b\n");
      }
      return Promise.reject(new Error("nope"));
    },
    hasTests: () => Promise.resolve(false),
    exists: (p) => Promise.resolve(String(p).endsWith(".memory.md")),
    home: "/home/u",
  });
  assertEquals(e.name, "demo");
  assertEquals(e.criticals, 0);
  assertEquals(e.warnings, 0);
  assertEquals(e.memoryFailureModes, 2);
  assertEquals(e.hasLessons, false);
  assertEquals(e.recommend, "refine");
  assertEquals(e.keywords.includes("design"), true);
});

Deno.test("catalogEntry: clean skill, no memory => ok", async () => {
  const e = await catalogEntry("/skills", "clean", {
    readTextFile: () =>
      Promise.resolve(
        "---\nname: clean\ndescription: A clean skill.\n---\n# Clean\nshort",
      ),
    hasTests: () => Promise.resolve(false),
    exists: () => Promise.resolve(false),
    home: "/home/u",
  });
  assertEquals(e.recommend, "ok");
  assertEquals(e.memoryFailureModes, 0);
  assertEquals(e.hasLessons, false);
});

Deno.test("catalogEntry: invalid skill => criticals>0, recommend=refine", async () => {
  const e = await catalogEntry("/skills", "bad", {
    readTextFile: () => Promise.resolve("no frontmatter here"),
    hasTests: () => Promise.resolve(false),
    exists: () => Promise.resolve(false),
    home: "/home/u",
  });
  assertEquals(e.criticals > 0, true);
  assertEquals(e.recommend, "refine");
});

Deno.test("catalogEntry: tests + lessons present are reflected", async () => {
  const e = await catalogEntry("/skills", "rich", {
    readTextFile: (p) =>
      String(p).endsWith(".memory.md")
        ? Promise.resolve("## ⚠️ Failure Modes\n- only one\n")
        : Promise.resolve(
          "---\nname: rich\ndescription: Rich skill.\n---\n# Rich\nbody",
        ),
    hasTests: () => Promise.resolve(true),
    exists: () => Promise.resolve(true),
    home: "/home/u",
  });
  assertEquals(e.hasTests, true);
  assertEquals(e.hasLessons, true);
  assertEquals(e.memoryFailureModes, 1);
  assertEquals(e.recommend, "refine");
});

Deno.test("formatCatalog: table + overlap section", () => {
  const out = formatCatalog(
    [{
      name: "alpha",
      criticals: 0,
      warnings: 1,
      bodyLines: 612,
      hasTests: false,
      memoryFailureModes: 0,
      hasLessons: false,
      keywords: ["x"],
      recommend: "refine",
    }],
    [{ a: "alpha", b: "beta", shared: ["design"] }],
  );
  assertEquals(out.includes("alpha"), true);
  assertEquals(out.includes("W1"), true);
  assertEquals(out.includes("refine"), true);
  assertEquals(out.includes("OVERLAP CANDIDATES"), true);
  assertEquals(out.includes("alpha ~ beta"), true);
  assertEquals(out.includes("Tier-1"), true);
});

Deno.test("formatCatalog: no overlaps => none", () => {
  const out = formatCatalog([], []);
  assertEquals(out.includes("OVERLAP CANDIDATES: none"), true);
});

Deno.test("formatCatalog: critical skill shows C prefix (precedence over W)", () => {
  const out = formatCatalog(
    [{
      name: "bad",
      criticals: 2,
      warnings: 1,
      bodyLines: 10,
      hasTests: false,
      memoryFailureModes: 0,
      hasLessons: false,
      keywords: [],
      recommend: "refine",
    }],
    [],
  );
  assertEquals(out.includes("C2"), true);
  assertEquals(out.includes("W1"), false); // criticals take precedence
});

const SCRIPT = new URL("./catalog-skills.ts", import.meta.url).pathname;

Deno.test("CLI: lists skills and exits 0 (advisory)", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "alpha"));
    await Deno.writeTextFile(
      join(tmp, "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill.\n---\n# Alpha\nbody",
    );
    const { code, stdout } = await new Deno.Command("deno", {
      args: ["run", "--allow-read", "--allow-env", SCRIPT],
      env: { VALIDATE_SKILLS_DIR: tmp, HOME: tmp },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const out = new TextDecoder().decode(stdout);
    assertEquals(code, 0);
    assertEquals(out.includes("alpha"), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
