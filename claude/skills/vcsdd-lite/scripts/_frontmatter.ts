import { parse as parseYaml } from "jsr:@std/yaml";
import type { NodeFrontmatter } from "./_types.ts";
import { VALID_NODE_TYPES } from "./_types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export class FrontmatterError extends Error {
  constructor(message: string, public readonly file: string) {
    super(`${file}: ${message}`);
    this.name = "FrontmatterError";
  }
}

export function extractFrontmatter(
  content: string,
  filePath: string,
): NodeFrontmatter | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1], { schema: "json" });
  } catch (e) {
    throw new FrontmatterError(
      `Invalid YAML: ${(e as Error).message}`,
      filePath,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FrontmatterError("Frontmatter must be an object", filePath);
  }

  const fm = parsed as Record<string, unknown>;

  if (typeof fm.id !== "string" || fm.id.length === 0) {
    throw new FrontmatterError("Missing or invalid 'id' field", filePath);
  }
  if (typeof fm.type !== "string" || fm.type.length === 0) {
    throw new FrontmatterError("Missing or invalid 'type' field", filePath);
  }
  if (typeof fm.feature !== "string" || fm.feature.length === 0) {
    throw new FrontmatterError("Missing or invalid 'feature' field", filePath);
  }

  if (!(VALID_NODE_TYPES as string[]).includes(fm.type)) {
    throw new FrontmatterError(
      `Invalid type: ${fm.type} (must be one of: ${VALID_NODE_TYPES.join(", ")})`,
      filePath,
    );
  }

  return parsed as NodeFrontmatter;
}
