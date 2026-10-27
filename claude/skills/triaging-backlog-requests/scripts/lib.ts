// Pure helpers for backlog-triage.ts (no I/O; unit-tested in lib.test.ts).

/** Marker embedded in every GitHub issue this tool creates (idempotency key). */
export const markerFor = (key: string) => `<!-- backlog: ${key} -->`;

export const backlogUrl = (space: string, key: string) =>
  `https://${space}/view/${key}`;

export type GhRef = {
  repo: string;
  kind: "pull" | "issues";
  number: number;
  commentId?: string;
};

/** GitHub issue/PR links (optionally with #issuecomment-N) found in free text. */
export function extractGhRefs(text: string, repo: string): GhRef[] {
  const re = new RegExp(
    String.raw`https://github\.com/${
      repo.replace("/", "\\/")
    }/(pull|issues)/(\d+)(?:#issuecomment-(\d+))?`,
    "g",
  );
  const seen = new Set<string>();
  const out: GhRef[] = [];
  for (const m of text.matchAll(re)) {
    const ref: GhRef = {
      repo,
      kind: m[1] as "pull" | "issues",
      number: Number(m[2]),
      ...(m[3] ? { commentId: m[3] } : {}),
    };
    const id = `${ref.kind}/${ref.number}/${ref.commentId ?? ""}`;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(ref);
    }
  }
  return out;
}

/** `#123` issue mentions in a PR body (e.g. "Closes #2103", "#2103 を参照"). */
export function extractIssueMentions(text: string): number[] {
  const nums = [...text.matchAll(/(?<![\w/&])#(\d{2,6})\b/g)].map((m) =>
    Number(m[1])
  );
  return [...new Set(nums)];
}

/** Status names that mean the Backlog request is still open. */
export const CLOSED_STATUS_NAMES = new Set(["処理済み", "完了"]);

export type Draft = {
  key: string;
  action: "create" | "add-to-project";
  title?: string;
  labels?: string[];
  body?: string;
  issue?: number; // for add-to-project
};

export type DraftCheck = { ok: true } | { ok: false; reason: string };

/** Validate a draft before anything is sent to GitHub. */
export function checkDraft(d: Draft, space: string): DraftCheck {
  if (!d.key) return { ok: false, reason: "key is required" };
  if (d.action === "add-to-project") {
    return d.issue ? { ok: true } : { ok: false, reason: "issue is required" };
  }
  if (d.action !== "create") {
    return { ok: false, reason: `unknown action: ${d.action}` };
  }
  if (!d.title?.trim()) return { ok: false, reason: "title is required" };
  if (!d.body?.trim()) return { ok: false, reason: "body is required" };
  const url = backlogUrl(space, d.key);
  if (!d.body.includes(url)) {
    return { ok: false, reason: `body must link the Backlog issue (${url})` };
  }
  return { ok: true };
}

/** Body actually sent: marker first, so later runs can detect the issue. */
export function finalBody(d: Draft): string {
  const marker = markerFor(d.key);
  return d.body!.includes(marker) ? d.body! : `${marker}\n${d.body}`;
}
