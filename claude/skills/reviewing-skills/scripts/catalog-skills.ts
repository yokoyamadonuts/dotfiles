// Advisory skill-health catalog (SP4: Management stage).
// Aggregates validate-skill (Tier-1) + .memory.md + filesystem signals across
// all skills and recommends refine / merge candidates. Advisory only: always
// exits 0. Reuses validate-skill.ts exports — no re-implementation of validation.

// NOTE: the VAL column reflects Tier-1 (structural) validation only — it does
// NOT run scripts/ tests (that needs --allow-run). Failing scripts/tests are
// surfaced by the gate `validate-skill <name>`, not by this advisory catalog.

import { join } from "jsr:@std/path";
import {
  defaultHasTests,
  listSkills,
  parseFrontmatter,
  skillsDir,
  validateContent,
} from "./validate-skill.ts";

// Stopwords: latin filler + generic skill vocabulary, and a few katakana terms.
// (Kanji is intentionally NOT extracted, which avoids common-kanji noise.)
const STOPWORDS = new Set([
  "skill",
  "skills",
  "claude",
  "code",
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "when",
  "uses",
  "used",
  "using",
  "リクエスト",
  "スキル",
]);

export type Overlap = { a: string; b: string; shared: string[] };

/** Extract significant keywords: latin words >=4 chars + katakana runs >=3,
 *  lowercased, minus stopwords. Approximate by design (no morphological analysis). */
export function extractKeywords(name: string, description: string): string[] {
  const text = `${name.replace(/[-_]/g, " ")} ${description}`.toLowerCase();
  const latin = text.match(/[a-z][a-z0-9-]{3,}/g) ?? [];
  const katakana = text.match(/[゠-ヿ]{3,}/g) ?? [];
  const out = new Set<string>();
  for (const w of [...latin, ...katakana]) {
    if (!STOPWORDS.has(w)) out.add(w);
  }
  return [...out];
}

/** Find skill pairs sharing >= minShared significant keywords (advisory). */
export function findOverlaps(
  entries: { name: string; keywords: string[] }[],
  minShared = 2,
): Overlap[] {
  const out: Overlap[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const setB = new Set(b.keywords);
      const shared = a.keywords.filter((k) => setB.has(k));
      if (shared.length >= minShared) {
        out.push({ a: a.name, b: b.name, shared });
      }
    }
  }
  return out;
}

export type Recommend = "refine" | "ok";

/** Count "- " bullets under the "## ... Failure Modes" heading (until the next "## "). */
export function countFailureModes(memoryContent: string): number {
  let inSection = false;
  let count = 0;
  for (const line of memoryContent.split("\n")) {
    if (/^##\s/.test(line)) {
      inSection = /failure modes/i.test(line);
      continue;
    }
    if (inSection && /^\s*-\s+/.test(line)) count++;
  }
  return count;
}

/** Per-skill recommendation from validation + memory signals. */
export function recommend(
  criticals: number,
  warnings: number,
  failureModes: number,
): Recommend {
  return criticals > 0 || warnings > 0 || failureModes > 0 ? "refine" : "ok";
}

export type CatalogEntry = {
  name: string;
  criticals: number;
  warnings: number;
  bodyLines: number;
  hasTests: boolean;
  memoryFailureModes: number;
  hasLessons: boolean;
  keywords: string[];
  recommend: Recommend;
};

export type CatalogDeps = {
  readTextFile?: (path: string | URL) => Promise<string>;
  hasTests?: (skillDir: string) => Promise<boolean>;
  exists?: (path: string) => Promise<boolean>;
  home?: string;
};

/** Default `exists` dep: true if the path exists (wraps Deno.stat). */
async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Aggregate one skill's health signals. Tier-1 validation only (no subprocess). */
export async function catalogEntry(
  skillsRoot: string,
  name: string,
  deps: CatalogDeps = {},
): Promise<CatalogEntry> {
  const readTextFile = deps.readTextFile ?? Deno.readTextFile;
  const hasTests = deps.hasTests ?? defaultHasTests;
  const exists = deps.exists ?? fileExists;
  const home = deps.home ?? Deno.env.get("HOME") ?? "";
  const skillDir = join(skillsRoot, name);

  const content = await readTextFile(join(skillDir, "SKILL.md"));
  const violations = validateContent(content);
  const criticals = violations.filter((v) => v.severity === "Critical").length;
  const warnings = violations.filter((v) => v.severity === "Warning").length;

  const parsed = parseFrontmatter(content);
  const bodyLines = parsed.ok ? parsed.body.split("\n").length : 0;
  const description = parsed.ok
    ? String(parsed.frontmatter.description ?? "")
    : "";
  const keywords = extractKeywords(name, description);

  const tests = await hasTests(skillDir);
  const hasLessons = await exists(join(skillDir, "references", "lessons.md"));

  let memoryFailureModes = 0;
  const memPath = home
    ? join(home, ".claude", "skills", name, ".memory.md")
    : "";
  if (memPath && (await exists(memPath))) {
    try {
      memoryFailureModes = countFailureModes(await readTextFile(memPath));
    } catch {
      // fail soft: unreadable memory => treat as no failure modes
    }
  }

  return {
    name,
    criticals,
    warnings,
    bodyLines,
    hasTests: tests,
    memoryFailureModes,
    hasLessons,
    keywords,
    recommend: recommend(criticals, warnings, memoryFailureModes),
  };
}

/** Render the catalog as a human-readable table + overlap section. */
export function formatCatalog(
  entries: CatalogEntry[],
  overlaps: Overlap[],
): string {
  const lines: string[] = [];
  lines.push(
    `${"SKILL".padEnd(30)} ${"VAL".padEnd(5)} ${
      "LINES".padStart(5)
    } TEST MEM LESS REC`,
  );
  for (const e of entries) {
    const val = e.criticals > 0
      ? `C${e.criticals}`
      : e.warnings > 0
      ? `W${e.warnings}`
      : "ok";
    lines.push(
      `${e.name.padEnd(30)} ${val.padEnd(5)} ${
        String(e.bodyLines).padStart(5)
      } ` +
        `${e.hasTests ? "yes" : "no "}  ${
          String(e.memoryFailureModes).padStart(3)
        } ` +
        `${e.hasLessons ? "yes" : "no "}  ${e.recommend}`,
    );
  }
  lines.push("");
  if (overlaps.length === 0) {
    lines.push("OVERLAP CANDIDATES: none");
  } else {
    lines.push("OVERLAP CANDIDATES (advisory — human judges):");
    for (const o of overlaps) {
      lines.push(`  ${o.a} ~ ${o.b}  (shared: ${o.shared.join(", ")})`);
    }
  }
  lines.push("");
  lines.push(
    "note: VAL is Tier-1 (structural) only — run `validate-skill <name>` for the test gate.",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  const dir = skillsDir();
  const names = await listSkills(dir);
  const entries: CatalogEntry[] = [];
  for (const name of names) {
    try {
      entries.push(await catalogEntry(dir, name));
    } catch (e) {
      // advisory: skip skills we can't read, note on stderr.
      console.error(`skip ${name}: ${(e as Error).message}`);
    }
  }
  const overlaps = findOverlaps(
    entries.map((e) => ({ name: e.name, keywords: e.keywords })),
  );
  console.log(formatCatalog(entries, overlaps));
  // advisory only — always exit 0 (no Deno.exit needed).
}

if (import.meta.main) {
  await main();
}
