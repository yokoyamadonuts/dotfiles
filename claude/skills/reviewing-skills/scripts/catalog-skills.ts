// Advisory skill-health catalog (SP4: Management stage).
// Aggregates validate-skill (Tier-1) + .memory.md + filesystem signals across
// all skills and recommends refine / merge candidates. Advisory only: always
// exits 0. Reuses validate-skill.ts exports — no re-implementation of validation.

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
