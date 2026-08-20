# Submission checklist

Straight from the assignment brief, so nothing gets missed at hour 47.

## Deliverables

- [ ] **GitHub repository** with full source: application, data-loading script,
      Cypher queries.
      If private, grant the reviewers access.
- [ ] **README** containing:
  - [x] the use case
  - [x] a "Why a graph database?" section
  - [x] a data model diagram
  - [x] setup and run instructions, including how to create the CognoDB instance
  - [x] the main queries explained
  - [x] screenshots of the UI
- [ ] **Hosted demo link** — mandatory. See [DEPLOY.md](DEPLOY.md).
- [ ] **Short screen recording** — mandatory. See [DEMO-SCRIPT.md](DEMO-SCRIPT.md).

## Fill in the placeholders

Search the repo for `{{`:

| Placeholder | Files |
|---|---|
| `{{YOUR_NAME}}` | `README.md`, `LICENSE`, `package.json` |
| `{{GITHUB_USERNAME}}` | `README.md`, `package.json` |
| `{{REPO_URL}}` | `README.md`, `docs/DEPLOY.md` |
| `{{DEMO_URL}}` | `README.md`, `docs/DEPLOY.md` |
| `{{VIDEO_URL}}` | `README.md` |

```bash
grep -rn "{{" --include="*.md" --include="*.json" .
```

## Before you send

- [ ] `npm run verify` passes (typecheck, Cypher parse, dataset validation)
- [ ] `npm run db:check` reports the graph is loaded
- [ ] The hosted URL loads and the lamp reads **Line up**
- [ ] **Leave the CognoDB instance running** — the brief asks for this
      explicitly, so reviewers can try the app against live data

## The email

**To:** hr@wexa.ai
**Subject:** `CognoDB Assignment 2 – Ebube Ezediimbu`

Include the repository URL and the demo link. Keep it short — the README does
the talking.

## For the follow-up interview

The brief says AI assistance is fine but you must be able to explain and defend
every part of the submission. The three things most likely to be probed:

1. **Why a graph, honestly?** The README's counter-argument paragraph is the
   answer: at 3,000 nodes Postgres would keep up; the case is readability and
   how the queries hold up as the estate grows, not raw speed today.
2. **Why version-level dependency edges?** Because an advisory names a *range*,
   and a package-level edge cannot tell you which release you resolved to.
3. **How do you keep a bounded traversal cheap on 0.5 vCPU?** `shortestPath`
   with both endpoints bound is bidirectional BFS — cost follows the graph, not
   the number of routes. Set-shaped questions use `DISTINCT` so a planner can
   prune. Candidate sets are cut *before* expensive traversals, not after.

Worth re-reading before the call: [QUERIES.md](QUERIES.md), and
`src/data/build-graph.ts` (the dataset verifies its own premises before it is
written).
