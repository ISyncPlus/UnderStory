# Walkthrough script

A short screen recording is **mandatory** for this submission. This is a
shot-by-shot script for a **three-minute** take. Read it, click it, done.

**Before you start**

- Seed the database (`npm run db:seed`) and open the **hosted** URL, not
  localhost — the recording should show the thing the reviewers will click.
- Browser at roughly 1440×900, no bookmarks bar, no extensions visible.
- Hard-refresh once first so the recording does not open on a cold start.
- Have `/advisories/USY-2026-0102` and `/trace?app=ledger-api&pkg=npm%3Alodash`
  ready in tabs if you want to avoid typing.

---

### 0:00 — 0:25 · What this is

**Screen:** the estate sheet at the top.

> "This is Understory. It reads a software organisation's dependency graph out of
> CognoDB and answers one shape of question: which of our applications can reach
> a given flaw, by what route, and what's the cheapest place to break the chain.
>
> Twelve applications, and 2,501 package releases underneath them — about
> fifteen thousand relationships in the graph. The organisation and the
> advisories are synthetic; the package names are real."

*Scroll slowly through the estate ledger.*

> "Each row is an application: what it declares, what it actually reaches, and
> the faults it can get to. The gap between those two numbers is the whole
> problem — Ledger API declares nineteen dependencies and stands on a hundred
> and twenty-nine packages."

---

### 0:25 — 0:50 · The data model, in one breath

**Screen:** stay on the estate sheet; the schedule panel top-right.

> "The model is six labels: Application, Package, PackageVersion, Maintainer,
> Advisory, License. The important decision is that dependencies are edges
> between *versions*, not packages — because when an advisory names a range, the
> only question that matters is which release you actually resolved to."

---

### 0:50 — 1:35 · The headline query

**Screen:** click a critical advisory in the fault register — use
**USY-2026-0102** (`ms`) or **USY-2026-0122** (`color-name`).

> "Here's one advisory. This panel is the blast radius: for every application in
> the estate, the shortest dependency path to an affected release."

*Point at one run diagram.*

> "Admin Console reaches it in three hops — it declared bcrypt, bcrypt pulls
> etag, etag pulls the affected version of ms. Nobody on that team chose ms.
> And three applications are not reached at all, which is a real answer, not
> missing data — the traversal ran across all twelve."

*Scroll to **Where to cut**.*

> "And this is the part I'd actually act on. Take the shortest path from every
> exposed application, drop the application at one end and the flaw at the other,
> and count what's left in the middle. `color-convert` sits on four of the nine
> paths — one upgrade removes four exposures."

---

### 1:35 — 2:00 · Show the Cypher

**Screen:** scroll to the bottom of the same sheet, click **Show the queries**.

> "Every panel in this app can show you exactly what produced it — the statement,
> the bound parameters, the record count and the server round trip."

*Expand and point at the `shortestPath` line.*

> "That's the whole traversal. `shortestPath` with both endpoints bound is a
> bidirectional breadth-first search, so its cost depends on the size of the
> graph rather than the number of routes between the two nodes — which is
> combinatorial here. Everything is a parameter; there's no string concatenation
> anywhere in the codebase, and a check in CI parses every statement against
> Neo4j's own grammar."

---

### 2:00 — 2:30 · Why is this here?

**Screen:** click **Trace**, pick **Ledger API**, type `lodash`, click a result.

> "This is the question people actually have. Ledger API reaches four different
> releases of lodash, by four different routes — one through jsonwebtoken, one
> through nodemailer, one through kafkajs. A dependency *list* can tell you
> lodash is there. Only the graph tells you how it got there, and therefore what
> would remove it."

---

### 2:30 — 2:50 · The thing with no advisory

**Screen:** click **Maintainers**.

> "Last one, because it's the query I'd defend hardest. These are packages with a
> single maintainer and no second factor on the account, ranked by how much of
> the estate sits above them. There's no CVE for this and nothing to upgrade to —
> it's purely the shape of the graph. Relationally it's a recursive closure
> joined against a group-by-having; here it's one traversal and a four-line
> predicate."

---

### 2:50 — 3:00 · Close

**Screen:** toggle **Stock → Negative**, then land back on the estate sheet.

> "Next.js and TypeScript, the official Neo4j driver over Bolt, hosted on Vercel
> against a free CognoDB instance. Repo's in the description. Thanks for
> watching."

---

## If you have five minutes rather than three

Add, between 2:00 and 2:30:

- **An application sheet** (`/applications/ledger-api`) — the depth profile, and
  the licence panel showing which copyleft licence arrived four hops down.
- **A designed failure state** — stop the instance in the CognoDB console,
  reload, and show that the app names the failure and the recovery instead of
  showing a stack trace. Start it again afterwards.
- **A package sheet** (`/packages/npm/lodash`) — every release, its licence, and
  which applications reach it.

## Recording notes

- macOS: `⇧⌘5` records a window. QuickTime → File → New Screen Recording works too.
- Say the numbers out loud. "Nine of twelve" is more convincing than pointing.
- One take is fine. A slightly rough three-minute take beats a polished ten.
- Upload unlisted to YouTube or Loom and put the link in the README's
  `{{VIDEO_URL}}` placeholder and the submission email.
