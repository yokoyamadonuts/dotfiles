export type NodeType = "req" | "spec" | "design" | "test" | "impl" | "verify";
export type Confidence = "green" | "amber" | "gray";
export type EdgeKind = "depends_on" | "satisfies" | "verified_by" | "verifies";
export type Status = "draft" | "reviewed" | "locked";
export type Mode = "lean" | "strict";

export interface FrontmatterCoherence {
  depends_on?: string[];
  satisfies?: string[];
  verified_by?: string[];
  beads?: string[];
}

export interface NodeFrontmatter {
  id: string;
  type: NodeType;
  feature: string;
  coherence?: FrontmatterCoherence;
  confidence?: Confidence;
  status?: Status;
  last_reviewed?: string;
}

export interface CoherenceNode {
  type: NodeType;
  path: string;
  confidence: Confidence;
  status?: Status;
  depends_on: string[];
  satisfies: string[];
  verified_by: string[];
  beads: string[];
}

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface Bead {
  members: string[];
  completeness: "full" | "partial";
}

export type IssueSeverity = "error" | "warning" | "info";
export type IssueKind =
  | "missing_reference"
  | "cycle"
  | "orphan"
  | "type_mismatch"
  | "incomplete_bead"
  | "gray_in_locked_spec";

export interface Issue {
  severity: IssueSeverity;
  kind: IssueKind;
  node?: string;
  field?: string;
  target?: string;
  members?: string[];
  cycle?: string[];
  message: string;
}

export interface Summary {
  total_nodes: number;
  confidence_distribution: Record<Confidence, number>;
  cycles_detected: number;
  missing_references: number;
  orphans: number;
}

export interface CoherenceGraph {
  $schema: "vcsdd-lite-coherence-v1";
  version: string;
  feature: string;
  scanned_at: string;
  scanner_version: string;
  mode: Mode;
  nodes: Record<string, CoherenceNode>;
  edges: Edge[];
  beads: Record<string, Bead>;
  issues: Issue[];
  summary: Summary;
}

export const SCANNER_VERSION = "vcsdd-lite/0.1";
export const SCHEMA_VERSION = "vcsdd-lite-coherence-v1" as const;
export const VALID_NODE_TYPES: NodeType[] = ["req", "spec", "design", "test", "impl", "verify"];
