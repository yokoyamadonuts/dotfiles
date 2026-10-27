import { assertEquals } from "jsr:@std/assert";
import {
  backlogUrl,
  checkDraft,
  extractGhRefs,
  extractIssueMentions,
  finalBody,
  markerFor,
} from "./lib.ts";

const REPO = "d-o-n-u-t-s/jbc-kintai-api";
const SPACE = "example.backlog.com";

Deno.test("extractGhRefs: PR with comment anchor, dedup, other repos ignored", () => {
  const text =
    `[URL](https://github.com/${REPO}/pull/1843#issuecomment-5214772922)
https://github.com/${REPO}/pull/1843#issuecomment-5214772922
https://github.com/${REPO}/pull/2071
https://github.com/d-o-n-u-t-s/Jobcan/pull/25204`;
  assertEquals(extractGhRefs(text, REPO), [
    { repo: REPO, kind: "pull", number: 1843, commentId: "5214772922" },
    { repo: REPO, kind: "pull", number: 2071 },
  ]);
});

Deno.test("extractIssueMentions: picks #n, ignores URLs anchors and entities", () => {
  assertEquals(
    extractIssueMentions(
      "調査は #2103 を参照。Closes #2103 / x#99 &#1234; a/#55",
    ),
    [2103],
  );
});

Deno.test("checkDraft: create requires Backlog link in body", () => {
  const base = { key: "P-1", action: "create" as const, title: "t" };
  assertEquals(checkDraft({ ...base, body: "no link" }, SPACE).ok, false);
  assertEquals(
    checkDraft({ ...base, body: `see ${backlogUrl(SPACE, "P-1")}` }, SPACE),
    { ok: true },
  );
});

Deno.test("checkDraft: add-to-project needs an issue number", () => {
  assertEquals(
    checkDraft({ key: "P-1", action: "add-to-project" }, SPACE).ok,
    false,
  );
  assertEquals(
    checkDraft({ key: "P-1", action: "add-to-project", issue: 5 }, SPACE),
    { ok: true },
  );
});

Deno.test("finalBody: prepends marker once", () => {
  const d = { key: "P-1", action: "create" as const, title: "t", body: "b" };
  assertEquals(finalBody(d), `${markerFor("P-1")}\nb`);
  assertEquals(
    finalBody({ ...d, body: finalBody(d) }),
    `${markerFor("P-1")}\nb`,
  );
});
