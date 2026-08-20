# Understory — Interview Explanation & Talking Points

> **Quick Summary:** A developer-friendly guide explaining what **Understory** is, the problem it solves, why a graph database is required, and how to demo it during an interview.

---

## 1. The 30-Second Elevator Pitch

> *"Most security scanners tell you **what** is broken—like a list of CVE vulnerabilities. But in a modern company with dozens of microservices and deep dependency trees, that doesn't tell you **how the vulnerable code got into your system** or **how to fix it**.*
> 
> ***Understory** is a graph-database application that models an entire company's software dependency tree. It answers the critical questions a relational database struggles with: **Which of our applications can reach this vulnerability, along what exact path, and what is the single package update that cuts off the risk for the most applications?***"

---

## 2. The Problem It Solves

When an engineering team builds an application:
1. They might directly declare **15–20 open-source libraries** (e.g., `express`, `ioredis`, `bcrypt`).
2. Each of those libraries pulls in other libraries, which pull in more libraries (**transitive dependencies**).
3. Soon, an application that declared 19 packages is actually running **120+ packages** deep in production.

### The Real-World Scenario:
- On Tuesday morning, a critical vulnerability is published for a package called `ms` or `color-name`.
- The security team asks: *"Are we exposed?"*
- Nobody on your team directly installed `ms`. Without a graph database, engineers spend hours grepping lockfiles across dozens of repositories trying to find where it came from.
- **Understory solves this in 1 click:** It reveals that `Ledger API` declared `bcrypt`, which pulled `etag`, which pulled `ms` (hop 3), and shows that updating `etag` immediately fixes 4 exposed services at once.

---

## 3. Why a Graph Database? (Graph vs. Relational SQL)

This is the #1 question interviewers will ask: **"Why not just use Postgres/MySQL?"**

| Relational Database (SQL) | Graph Database (CognoDB / openCypher) |
|---|---|
| Requires expensive recursive CTEs and multiple `JOIN`s to traverse multi-level dependencies. | Native pointer-hopping traversals (`(app)-[:DEPENDS_ON*]->(package)`). |
| Finding the **shortest path** between arbitrary nodes across millions of paths is slow and combinatorial. | Native `shortestPath()` algorithms (bidirectional breadth-first search) execute in milliseconds. |
| Struggles with supply-chain questions like *"Show me maintainers with no 2FA whose packages sit underneath 80% of our applications"*. | Simple pattern-matching graph queries over relationships and node properties. |

---

## 4. Key Features & How to Use the App

### 1. Estate Ledger (`/`)
- **What you see:** A bird's-eye view of all 12 corporate applications.
- **Key Insight:** Shows the difference between **Declared dependencies** (what developers wrote down, e.g., 19) and **Actual Reach** (what actually runs in production, e.g., 129).
- **Fault Register:** Lists all active advisories ranked by how many applications they reach.

### 2. Advisory Blast Radius & "Where to Cut" (`/advisories/[id]`)
- **What you see:** The blast radius of a specific vulnerability across all applications.
- **Visual Route:** Displays the step-by-step orthogonal dependency chain from your app down to the vulnerable release.
- **"Where to Cut" Recommendation:** Calculates the bottleneck node on the path. Upgrading one intermediate package can eliminate exposure across multiple applications simultaneously.

### 3. Trace Route (`/trace`)
- **What you see:** Answers the question *"Why is this package in my app?"*.
- **How to use:** Select an application (e.g., `Ledger API`) and search for any package (e.g., `lodash`). It draws every active route explaining why it's there.

### 4. Maintainer Risk / Chokepoints (`/maintainers`)
- **What you see:** Identifies supply chain risks that are **not CVEs**—for example, single-maintainer packages with no two-factor authentication (2FA) that underpin critical applications.

### 5. "Show the Queries" Disclosure
- Every single panel in the UI has an expandable **"Show the queries"** button displaying the exact parameterised openCypher query, execution time, and record count.

---

## 5. Technical Architecture & Stack

- **Frontend / Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4.
- **Database:** CognoDB Cloud / Neo4j instance over Bolt protocol using the official `neo4j-driver`.
- **Query Language:** openCypher (parameterised queries with zero string concatenation).
- **Data Model:**
  - **Nodes:** `Application`, `Package`, `PackageVersion`, `Maintainer`, `Advisory`, `License`.
  - **Edges:** `DEPENDS_ON` (between versions), `VERSION_OF`, `MAINTAINED_BY`, `AFFECTS`, `LICENSED_UNDER`.
- **Design Aesthetic:** Inspired by physical telephone-exchange cable records—drafting buff stock (`#f4f2ea`), technical ink linework, and jumper vermilion highlights for active routes.

---

## 6. How to Demo This in Your Interview (3-Minute Script)

1. **Minute 0:00 – 0:45 (The Estate Overview):**
   - *"This is Understory. It models a software company's dependency graph in CognoDB with ~3,000 nodes and 15,000 relationships."*
   - Point out the Estate table: *"Notice how Ledger API declares 19 packages but reaches 129. The gap between those numbers is where unmanaged risk lives."*
2. **Minute 0:45 – 1:45 (The Advisory & Cut Recommendation):**
   - Click a critical advisory (e.g., `USY-2026-0102`).
   - *"Here is the blast radius. We see Admin Console reaches it in 3 hops through `bcrypt` → `etag` → `ms`. Down in 'Where to Cut', the graph tells us that upgrading `color-convert` severs the vulnerability across 4 applications at once."*
3. **Minute 1:45 – 2:30 (Cypher Transparency & Trace):**
   - Click **"Show the queries"** at the bottom to show the `shortestPath` openCypher query.
   - Go to **Trace**, select `Ledger API` and search `lodash` to demonstrate tracing multiple converging dependency paths.
4. **Minute 2:30 – 3:00 (Supply Chain Chokepoints & Wrap-Up):**
   - Click **Maintainers** to highlight packages maintained by a single person with no 2FA.
   - Wrap up with: *"It's built with Next.js, TypeScript, and Bolt-driven openCypher against CognoDB."*

---

## 7. Likely Interview Questions & Answers

### Q: "Why are dependency edges between versions instead of packages?"
> **Answer:** Because advisories and breaking changes happen at the *version* level. If `lodash@4.17.20` has a flaw but `4.17.21` is safe, knowing you depend on the package `lodash` is insufficient—you must know which specific resolved version your application reaches.

### Q: "How does the `shortestPath` query perform at scale?"
> **Answer:** When both endpoints (the application and the target package) are bound, `shortestPath` uses bidirectional breadth-first search. Its complexity depends on graph locality and depth rather than the combinatorial explosion of all possible routes.

### Q: "How does the app handle database downtime?"
> **Answer:** It features designed error states rather than raw stack traces. The masthead Line Lamp reports live round-trip latency, and if the database is asleep or disconnected, clean fallback cards guide the user on how to reconnect.
