#!/usr/bin/env -S deno run --allow-read --allow-write
import { walk } from "jsr:@std/fs/walk";
import { relative, join } from "jsr:@std/path";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { extractFrontmatter, FrontmatterError } from "./_frontmatter.ts";
import type {
  Bead,
  CoherenceGraph,
  CoherenceNode,
  Confidence,
  Edge,
  Summary,
} from "./_types.ts";
import { SCANNER_VERSION, SCHEMA_VERSION } from "./_types.ts";

const CWD = Deno.cwd();

export async function scanFeature(
  featureDir: string,
  featureName: string,
  mode: "lean" | "strict" = "lean",
): Promise<CoherenceGraph> {
  const specsDir = join(featureDir, "specs");

  const nodes: Record<string, CoherenceNode> = {};
  const beadMembers: Record<string, Set<string>> = {};

  for await (const entry of walk(specsDir, {
    exts: [".md"],
    includeDirs: false,
  })) {
    const content = await Deno.readTextFile(entry.path);
    let fm;
    try {
      fm = extractFrontmatter(content, entry.path);
    } catch (e) {
      if (e instanceof FrontmatterError) {
        console.error(`Warning: ${e.message}`);
        continue;
      }
      throw e;
    }
    if (!fm) continue;
    if (fm.feature !== featureName) continue;

    if (fm.id in nodes) {
      throw new Error(`Duplicate node id: ${fm.id} (in ${entry.path})`);
    }

    const coherence = fm.coherence ?? {};
    const node: CoherenceNode = {
      type: fm.type,
      path: relative(CWD, entry.path),
      confidence: fm.confidence ?? "gray",
      status: fm.status,
      depends_on: coherence.depends_on ?? [],
      satisfies: coherence.satisfies ?? [],
      verified_by: coherence.verified_by ?? [],
      beads: coherence.beads ?? [],
    };
    nodes[fm.id] = node;

    for (const beadId of node.beads) {
      if (!(beadId in beadMembers)) beadMembers[beadId] = new Set();
      beadMembers[beadId].add(fm.id);
    }
  }

  // Auto-confidence (only if frontmatter did not specify)
  for (const [id, node] of Object.entries(nodes)) {
    if (await wasConfidenceManuallySet(node.path)) continue;
    node.confidence = computeConfidence(id, node, nodes);
  }

  const edges = buildEdges(nodes);
  const beads = buildBeads(beadMembers);
  const summary = buildSummary(nodes);

  return {
    $schema: SCHEMA_VERSION,
    version: "1.0",
    feature: featureName,
    scanned_at: new Date().toISOString(),
    scanner_version: SCANNER_VERSION,
    mode,
    nodes,
    edges,
    beads,
    issues: [],
    summary,
  };
}

async function wasConfidenceManuallySet(filePath: string): Promise<boolean> {
  const content = await Deno.readTextFile(join(CWD, filePath));
  return /^confidence:\s*\S/m.test(content.split(/^---/m)[1] ?? "");
}

function buildEdges(nodes: Record<string, CoherenceNode>): Edge[] {
  const edges: Edge[] = [];
  for (const [from, node] of Object.entries(nodes)) {
    for (const to of node.depends_on) {
      edges.push({ from, to, kind: "depends_on" });
    }
    for (const to of node.satisfies) {
      edges.push({ from, to, kind: "satisfies" });
    }
    for (const to of node.verified_by) {
      edges.push({ from, to, kind: "verified_by" });
    }
  }
  return edges;
}

function buildBeads(
  beadMembers: Record<string, Set<string>>,
): Record<string, Bead> {
  const result: Record<string, Bead> = {};
  for (const [beadId, members] of Object.entries(beadMembers)) {
    result[beadId] = {
      members: [...members].sort(),
      completeness: members.size >= 5 ? "full" : "partial",
    };
  }
  return result;
}

function computeConfidence(
  _id: string,
  node: CoherenceNode,
  allNodes: Record<string, CoherenceNode>,
): Confidence {
  const hasMissing =
    [...node.depends_on, ...node.satisfies, ...node.verified_by]
      .some((target) => !(target in allNodes));
  if (hasMissing) return "gray";

  if (node.type === "spec") {
    if (node.satisfies.length >= 1 && node.verified_by.length >= 1) {
      return "green";
    }
    if (node.satisfies.length >= 1 || node.verified_by.length >= 1) {
      return "amber";
    }
    return "gray";
  }
  return "amber";
}

function buildSummary(nodes: Record<string, CoherenceNode>): Summary {
  const dist: Record<Confidence, number> = { green: 0, amber: 0, gray: 0 };
  for (const node of Object.values(nodes)) {
    dist[node.confidence]++;
  }
  return {
    total_nodes: Object.keys(nodes).length,
    confidence_distribution: dist,
    cycles_detected: 0,
    missing_references: 0,
    orphans: 0,
  };
}

// CLI entry
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "out", "mode"],
    boolean: ["dry-run"],
    default: { mode: "lean" },
  });

  if (!args.feature) {
    console.error("Error: --feature <name> is required");
    Deno.exit(2);
  }

  const featureDir = join(CWD, "docs", "vcsdd", args.feature);
  try {
    await Deno.stat(featureDir);
  } catch {
    console.error(`Error: feature directory not found: ${featureDir}`);
    Deno.exit(2);
  }

  const graph = await scanFeature(featureDir, args.feature, args.mode as "lean" | "strict");

  const outPath = args.out ?? join(featureDir, "coherence.json");
  const json = JSON.stringify(graph, null, 2);

  if (args["dry-run"]) {
    console.log(json);
  } else {
    await Deno.writeTextFile(outPath, json);
    console.log(`Wrote ${outPath}`);
  }
}
