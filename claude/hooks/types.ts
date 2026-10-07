// Type definitions for Claude Code hook stdin JSON (command hooks).
// Shapes follow the official hooks reference (code.claude.com/docs/en/hooks):
// common input fields + PostToolUse fields. Only what the hooks here read is
// modelled; everything else is left as `unknown`.

/** Fields every hook event receives. */
export type HookCommonInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  permission_mode?: string;
  prompt_id?: string;
  scratchpad_dir?: string;
  effort?: { level: "low" | "medium" | "high" | "xhigh" | "max" };
  agent_id?: string;
  agent_type?: string;
};

/** PostToolUse: `tool_response` is the tool's structured Output object. */
export type PostToolUseHookData<T = ToolParams, R = ToolResponse> =
  & HookCommonInput
  & {
    tool_name: string;
    tool_input: T;
    tool_response: R;
    tool_use_id?: string;
    duration_ms?: number;
  };

// --- tool_input -------------------------------------------------------------

export type WriteToolParams = {
  file_path: string;
  content: string;
};

export type EditToolParams = {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
};

/** Union of the file-modification tools (MultiEdit was removed upstream). */
export type FileModificationToolParams = WriteToolParams | EditToolParams;

/** Skill tool parameters (used by the skill-memory PostToolUse hook). */
export type SkillToolParams = {
  skill: string;
  args?: string;
};

/** Generic tool params type for other tools. */
export type ToolParams = FileModificationToolParams | Record<string, unknown>;

// --- tool_response ----------------------------------------------------------

/** Write output as documented: `{ filePath, type }`. */
export type WriteToolResponse = {
  filePath: string;
  type: "create" | "update";
};

/** Edit output: `filePath` is stable; other fields are not relied upon. */
export type EditToolResponse = {
  filePath: string;
  [key: string]: unknown;
};

/** Bash output; `bashEditDiff` is present when the command edited files
 * (auto mode / `bashEditDiffEnabled`, best effort, Claude Code v2.1.269+). */
export type BashToolResponse = {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  bashEditDiff?: {
    changedFiles?: string[];
    moreFiles?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ToolResponse =
  | WriteToolResponse
  | EditToolResponse
  | BashToolResponse
  | Record<string, unknown>;

// --- type guards ------------------------------------------------------------

export function isWriteToolParams(params: unknown): params is WriteToolParams {
  return typeof params === "object" && params !== null &&
    "content" in params && "file_path" in params;
}

export function isEditToolParams(params: unknown): params is EditToolParams {
  return typeof params === "object" && params !== null &&
    "old_string" in params && "new_string" in params && "file_path" in params;
}
