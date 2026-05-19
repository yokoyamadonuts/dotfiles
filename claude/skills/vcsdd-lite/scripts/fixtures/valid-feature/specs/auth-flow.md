---
id: spec:auth-flow
type: spec
feature: valid-feature
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
  verified_by:
    - test:auth-edge-cases
  beads:
    - bead:B-001-login
confidence: green
status: reviewed
---

# Auth Flow Specification
