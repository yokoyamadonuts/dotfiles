// Desktop notifications for Claude Code hook events (macOS only, fail-open).
//
// Wired from ../settings.json:
//   Notification --type notify   (permission_prompt / idle_prompt / agent_* types)
//   Stop         --type stop     (turn finished; shows the tail of the last message)
//   StopFailure  --type failure  (turn ended on an API error such as rate_limit)
//
// Uses terminal-notifier when installed, otherwise falls back to the built-in
// Notification Center via osascript. Any error exits 0 so the hook never blocks.
import { parseArgs } from "jsr:@std/cli/parse-args";
import $ from "jsr:@david/dax";

/** Subset of the hook stdin JSON we read (see docs: hooks reference). */
type HookInput = {
  hook_event_name?: string;
  cwd?: string;
  // Notification
  message?: string;
  title?: string;
  notification_type?: string;
  // Stop / StopFailure
  last_assistant_message?: string;
  error?: string;
};

/** Max characters of a message body to put in a notification. */
const MAX_BODY = 120;

const flags = parseArgs(Deno.args, { string: ["type"] });

async function readInput(): Promise<HookInput> {
  try {
    return await new Response(Deno.stdin.readable).json();
  } catch {
    return {};
  }
}

/** Last path segment of cwd, used as a project tag in the title. */
export function projectTag(cwd?: string): string {
  const name = cwd?.split("/").filter(Boolean).pop();
  return name ? ` [${name}]` : "";
}

/** Collapse whitespace and cap the body length. */
export function body(text: string | undefined, fallback: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  return t.length > MAX_BODY ? t.slice(0, MAX_BODY - 1) + "…" : t;
}

async function send(title: string, message: string): Promise<void> {
  if (await $.commandExists("terminal-notifier")) {
    await $`terminal-notifier -title ${title} -message ${message} -sound default`
      .quiet();
    return;
  }
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await $`osascript -e ${`display notification "${esc(message)}" with title "${
    esc(title)
  }"`}`.quiet();
}

async function main(): Promise<void> {
  const input = await readInput();
  const tag = projectTag(input.cwd);
  switch (flags.type) {
    case "notify":
      await send(
        (input.title ?? "Claude Code") + tag,
        body(input.message, input.notification_type ?? "Attention needed"),
      );
      break;
    case "stop":
      await send(
        "Claude Code" + tag,
        body(input.last_assistant_message, "Turn finished"),
      );
      break;
    case "failure":
      await send(
        `Claude Code error${tag}`,
        body(input.last_assistant_message, input.error ?? "API error"),
      );
      break;
    default:
      break;
  }
}

if (import.meta.main && Deno.build.os === "darwin") {
  try {
    await main();
  } catch {
    // fail open: a broken notifier must never block Claude Code
  }
}
