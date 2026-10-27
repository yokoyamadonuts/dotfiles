// Backlog → GitHub issue triage. Two subcommands:
//
//   collect --project KEY --repo OWNER/REPO [--space HOST] [--out ledger.json]
//     Reads the open Backlog issues assigned to you (bee), fetches each one's
//     description and comments, and looks for existing GitHub issues that
//     already cover it: the Backlog key / marker in an issue body, the same
//     QA comment URL, or an issue referenced by a PR the Backlog text links.
//     Read-only on both sides. Writes a JSON ledger and prints a table.
//
//   apply drafts.json --repo OWNER/REPO --gh-project N --owner ORG [--space HOST] [--yes]
//     Validates drafts (body must link the Backlog issue), re-checks for an
//     existing issue with the same Backlog key, then creates the issue and adds
//     it to the GitHub Project. Without --yes it only prints what it would do.
//
// Requires: bee (authenticated), gh (repo + project scopes), Deno.
import { parseArgs } from "jsr:@std/cli/parse-args";
import {
  backlogUrl,
  checkDraft,
  CLOSED_STATUS_NAMES,
  type Draft,
  extractGhRefs,
  extractIssueMentions,
  finalBody,
  markerFor,
} from "./lib.ts";

async function run(cmd: string, args: string[]): Promise<string> {
  const out = await new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  })
    .output();
  if (!out.success) {
    throw new Error(
      `${cmd} ${args.join(" ")}\n${new TextDecoder().decode(out.stderr)}`,
    );
  }
  return new TextDecoder().decode(out.stdout);
}
const json = async <T>(cmd: string, args: string[]) =>
  JSON.parse(await run(cmd, args)) as T;

async function defaultSpace(): Promise<string> {
  const status = await run("bee", ["auth", "status"]);
  const m = status.match(/([a-z0-9-]+\.backlog\.(?:com|jp))\s+\(default\)/);
  if (!m) {
    throw new Error(
      "no default Backlog space; pass --space or run `bee auth login`",
    );
  }
  return m[1];
}

type GhHit = {
  number: number;
  title: string;
  state: string;
  url: string;
  via: string;
};

async function searchIssues(
  repo: string,
  q: string,
  via: string,
): Promise<GhHit[]> {
  const rows = await json<Omit<GhHit, "via">[]>("gh", [
    "search",
    "issues",
    "--repo",
    repo,
    q,
    "--limit",
    "10",
    "--json",
    "number,title,state,url",
  ]);
  return rows.map((r) => ({ ...r, via }));
}

async function existingFor(
  repo: string,
  key: string,
  text: string,
): Promise<GhHit[]> {
  const hits: GhHit[] = [
    ...await searchIssues(repo, key, `Backlog key ${key}`),
  ];
  for (const ref of extractGhRefs(text, repo)) {
    if (ref.commentId) {
      hits.push(
        ...await searchIssues(
          repo,
          ref.commentId,
          `same comment ${ref.kind}/${ref.number}#${ref.commentId}`,
        ),
      );
    }
    if (ref.kind === "issues") {
      const i = await json<Omit<GhHit, "via">>("gh", [
        "issue",
        "view",
        String(ref.number),
        "-R",
        repo,
        "--json",
        "number,title,state,url",
      ]);
      hits.push({ ...i, via: `linked issue #${ref.number}` });
    }
    if (ref.kind === "pull" && !ref.commentId) {
      const pr = await json<{ body: string; number: number }>("gh", [
        "pr",
        "view",
        String(ref.number),
        "-R",
        repo,
        "--json",
        "number,body",
      ]);
      for (const n of extractIssueMentions(pr.body ?? "")) {
        try {
          const i = await json<Omit<GhHit, "via">>("gh", [
            "issue",
            "view",
            String(n),
            "-R",
            repo,
            "--json",
            "number,title,state,url",
          ]);
          hits.push({ ...i, via: `referenced by linked PR #${pr.number}` });
        } catch { /* #n was a PR, not an issue */ }
      }
    }
  }
  const seen = new Set<number>();
  return hits.filter((h) => !seen.has(h.number) && seen.add(h.number));
}

async function collect(a: ReturnType<typeof parseArgs>) {
  const project = String(a.project ?? "");
  const repo = String(a.repo ?? "");
  if (!project || !repo) throw new Error("collect needs --project and --repo");
  const space = a.space ? String(a.space) : await defaultSpace();

  const statuses = await json<{ id: number; name: string }[]>("bee", [
    "status",
    "list",
    "-p",
    project,
    "--json",
    "id,name",
  ]);
  const open = statuses.filter((s) => !CLOSED_STATUS_NAMES.has(s.name));
  const list = await json<{ issueKey: string }[]>("bee", [
    "issue",
    "list",
    "-p",
    project,
    "-a",
    "@me",
    "-L",
    "100",
    "--json",
    "issueKey",
    ...open.flatMap((s) => ["-S", String(s.id)]),
  ]);
  if (list.length === 100) {
    console.error("warning: 100 results — there may be more (paginate)");
  }

  const ledger = [];
  for (const { issueKey } of list) {
    const issue = await json<Record<string, any>>("bee", [
      "issue",
      "view",
      issueKey,
      "--json",
    ]);
    const comments = await json<
      {
        content: string | null;
        created: string;
        createdUser: { name: string };
      }[]
    >(
      "bee",
      ["api", `issues/${issueKey}/comments`, "-f", "count=100"],
    );
    const commentText = comments.map((c) => c.content ?? "").filter(Boolean);
    const text = [issue.description ?? "", ...commentText].join("\n");
    ledger.push({
      key: issueKey,
      url: backlogUrl(space, issueKey),
      summary: issue.summary,
      type: issue.issueType?.name,
      status: issue.status?.name,
      categories: (issue.category ?? []).map((c: { name: string }) => c.name),
      created: issue.created,
      createdBy: issue.createdUser?.name,
      description: issue.description ?? "",
      comments: comments.filter((c) => c.content).map((c) => ({
        at: c.created,
        by: c.createdUser?.name,
        text: c.content,
      })),
      existing: await existingFor(repo, issueKey, text),
    });
  }
  const out = a.out ? String(a.out) : "ledger.json";
  await Deno.writeTextFile(
    out,
    JSON.stringify({ space, project, repo, ledger }, null, 2),
  );
  console.log(
    `ledger: ${out} (${ledger.length} open Backlog issues assigned to you)\n`,
  );
  console.log("key\ttype\tstatus\texisting GitHub issues\tsummary");
  for (const l of ledger) {
    const ex = l.existing.map((e) =>
      `#${e.number}[${e.state}](${e.via})`
    ).join(" ") || "-";
    console.log(`${l.key}\t${l.type}\t${l.status}\t${ex}\t${l.summary}`);
  }
}

async function apply(a: ReturnType<typeof parseArgs>) {
  const file = String(a._[1] ?? "");
  const repo = String(a.repo ?? "");
  const ghProject = String(a["gh-project"] ?? "");
  const owner = String(a.owner ?? "");
  if (!file || !repo || !ghProject || !owner) {
    throw new Error("apply needs drafts.json --repo --gh-project --owner");
  }
  const space = a.space ? String(a.space) : await defaultSpace();
  const yes = Boolean(a.yes);
  const drafts = JSON.parse(await Deno.readTextFile(file)) as Draft[];

  const bad = drafts.map((d) => ({ d, c: checkDraft(d, space) })).filter((x) =>
    !x.c.ok
  );
  if (bad.length) {
    for (const { d, c } of bad) {
      console.error(`INVALID ${d.key}: ${(c as { reason: string }).reason}`);
    }
    Deno.exit(1);
  }

  for (const d of drafts) {
    if (d.action === "add-to-project") {
      const url = `https://github.com/${repo}/issues/${d.issue}`;
      console.log(
        `${
          yes ? "ADD" : "WOULD ADD"
        } ${d.key}: #${d.issue} → project ${ghProject}`,
      );
      if (yes) {
        await run("gh", [
          "project",
          "item-add",
          ghProject,
          "--owner",
          owner,
          "--url",
          url,
        ]);
      }
      continue;
    }
    const dup = [
      ...await searchIssues(repo, d.key, "key"),
      ...await searchIssues(repo, `"${markerFor(d.key)}"`, "marker"),
    ];
    if (dup.length) {
      console.log(
        `SKIP ${d.key}: already covered by ${
          dup.map((x) => `#${x.number}`).join(", ")
        }`,
      );
      continue;
    }
    console.log(
      `${yes ? "CREATE" : "WOULD CREATE"} ${d.key}: ${d.title} [${
        (d.labels ?? []).join(", ")
      }] → project ${ghProject}`,
    );
    if (!yes) continue;
    const bodyFile = await Deno.makeTempFile({ suffix: ".md" });
    await Deno.writeTextFile(bodyFile, finalBody(d));
    const url = (await run("gh", [
      "issue",
      "create",
      "-R",
      repo,
      "--title",
      d.title!,
      "--body-file",
      bodyFile,
      ...(d.labels ?? []).flatMap((l) => ["--label", l]),
    ])).trim().split("\n").pop()!;
    await Deno.remove(bodyFile);
    await run("gh", [
      "project",
      "item-add",
      ghProject,
      "--owner",
      owner,
      "--url",
      url,
    ]);
    console.log(`  → ${url}`);
  }
  if (!yes) console.log("\n(dry run — re-run with --yes to send)");
}

if (import.meta.main) {
  const a = parseArgs(Deno.args, {
    string: ["project", "repo", "space", "out", "gh-project", "owner"],
    boolean: ["yes"],
  });
  const sub = a._[0];
  if (sub === "collect") await collect(a);
  else if (sub === "apply") await apply(a);
  else {
    console.error("usage: backlog-triage.ts collect|apply ... (see header)");
    Deno.exit(2);
  }
}
