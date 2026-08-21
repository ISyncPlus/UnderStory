# Deploying the hosted demo

The assignment makes a hosted demo **mandatory**. This takes about five minutes
on Vercel's free tier, and the application was built to make it uneventful:
`next build` never touches the database, so a bad credential fails at request
time with a designed error state rather than breaking the build.

---

## Vercel

### 1. Push the repository

```bash
git init
git add .
git commit -m "Understory: dependency reach over a graph database"
git branch -M main
git remote add origin https://github.com/ISyncPlus/UnderStory.git
git push -u origin main
```

If you keep the repo private, the assignment asks you to grant the reviewers
access.

### 2. Import it

Go to <https://vercel.com/new>, import the repository, and accept the detected
settings — Vercel recognises Next.js and needs no build configuration.

### 3. Add the environment variables

Before the first deploy, add these under **Settings → Environment Variables**
for **Production, Preview and Development**:

| Name | Value |
|---|---|
| `NEO4J_URI` | `bolt+s://<instance-id>.databases.cognodb.cloud` |
| `NEO4J_USERNAME` | `cognodb` |
| `NEO4J_PASSWORD` | your saved password |
| `NEXT_PUBLIC_INSTANCE_LABEL` | `CognoDB c0 · free tier` (optional, cosmetic) |

Do **not** set `UNDERSTORY_FIXTURES`. Setting it would ship the in-memory
fixture graph instead of the real database, which is the opposite of what the
demo is for.

### 4. Deploy

Deploy, then open the URL and confirm the lamp in the top-right reads
**Line up**. Ensure that URL is linked in the README and submission email.

---

## Things worth knowing

**Every database-backed page is dynamic.** Each carries
`export const dynamic = 'force-dynamic'`, so nothing is prerendered at build
time and no page is served from a stale cache. It also means the build succeeds
on a machine with no database at all, which is what lets CI typecheck and build
without secrets.

**The driver is cached per warm instance.** `src/lib/neo4j.ts` keeps the driver
on `globalThis`, so a warm serverless invocation reuses the connection pool
rather than opening a fresh TLS handshake per request. Nothing in the request
path ever calls `driver.close()` — closing per request is the fastest way to
exhaust a small instance's 200-connection budget.

**Cold starts are visible and handled.** The first request after an idle period
hits both a cold lambda and a burstable database. If the database does not answer
within 20 seconds the page renders the *"did not answer in time"* state with a
retry, rather than hanging until the platform kills the function.

**Node runtime, not Edge.** The Bolt driver is a TCP client and cannot run on the
Edge runtime. `next.config.ts` marks `neo4j-driver` as a server-external package
so a mistake here fails loudly at build time instead of silently at runtime.

---

## Other free hosts

Nothing here is Vercel-specific. Any host that runs a Node 20 server works:

```bash
npm ci
npm run build
npm start          # honours PORT
```

Render, Railway and Fly all take that directly. The one requirement is a **Node**
runtime with outbound TCP on port 7687 — a static host or an edge-only runtime
cannot speak Bolt.

---

## Post-deploy checklist

- [ ] The URL loads and the lamp reads **Line up**
- [ ] The estate sheet shows twelve applications and 2,501 releases
- [ ] Opening an advisory draws the runs
- [ ] "Show the queries" expands and displays real Cypher with timings
- [ ] The trace page returns routes for `Ledger API → lodash`
- [ ] It is readable on a phone
- [ ] The live demo URL in the README is filled in
- [ ] The CognoDB instance is left **running**
