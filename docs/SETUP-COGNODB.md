# Setting up CognoDB

Everything here is a value you copy out of the CognoDB console and paste into
one file. It takes about five minutes, most of which is waiting for the instance
to provision.

> **Placeholders in this repo are marked `{{LIKE_THIS}}` or `REPLACE_ME`.**
> The only two you *must* fill in to run the application are `NEO4J_URI` and
> `NEO4J_PASSWORD`.

---

## 1. Create the account

Go to **<https://console.cognodb.com/signup>** and sign up. The free tier needs
no credit card.

## 2. Create the free instance

From the console, create a **free (c0)** instance and pick a region. Choose the
region closest to where you will host the demo — the application makes several
round trips per page, and a transatlantic hop is the difference between a
snappy sheet and a slow one. It provisions in under a minute.

Each workspace gets one free instance.

## 3. Save the connection details — you get one chance at the password

When the instance is ready the console shows you:

| What | Shape | Goes into |
|---|---|---|
| Connection URI | `bolt+s://<instance-id>.databases.cognodb.cloud` | `NEO4J_URI` |
| Username | `cognodb` | `NEO4J_USERNAME` (already the default) |
| Password | a generated string | `NEO4J_PASSWORD` |

**The password is shown exactly once.** Copy it or download the credentials file
immediately. If you lose it, the fix is to rotate the password (or recreate the
instance) from the console — there is no way to read it back.

The `bolt+s://` scheme carries TLS, so no extra driver configuration is needed.
Do not change it to `bolt://` or `neo4j://`.

## 4. Put the values where the code reads them

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```dotenv
NEO4J_URI=bolt+s://a1b2c3d4.databases.cognodb.cloud
NEO4J_USERNAME=cognodb
NEO4J_PASSWORD=the-password-you-just-copied
NEO4J_DATABASE=
NEXT_PUBLIC_INSTANCE_LABEL=CognoDB c0 · free tier
```

`.env.local` is gitignored. Nothing in this repository ever reads a credential
from anywhere else, and no credential is ever committed.

Leave `NEO4J_DATABASE` blank unless the console tells you otherwise — a free c0
instance uses the default database.

## 5. Check the connection before loading anything

```bash
npm run db:check
```

It reports four things in order, and each failure names its own fix:

```
Understory — connection check

  ✓ Environment is configured.      cognodb@a1b2c3d4.databases.cognodb.cloud
  ✓ Reachable and authenticated.    handshake in 412 ms
  ! Connected, but the graph is empty.
    Run `npm run db:seed` to load it.
```

If it stops at the first line, `.env.local` is missing or still has the
placeholder. If it stops at the second with *"Credentials were refused"*, the
password is wrong — see step 3. If it stops with *"Could not reach the
instance"*, check the instance is running in the console and that the URI matches
character for character.

## 6. Load the graph

```bash
npm run db:seed
```

This applies the schema (six uniqueness constraints, six indexes) and writes
**2,971 nodes and 15,280 relationships** in batches of 400. It takes a minute or
two on a free instance and prints progress per label:

```
Schema
  ✓ application_slug
  ✓ package_key
  …

Nodes
  Application                12
  License                    11
  Maintainer                 174
  Package                    251
  Advisory                   22
  PackageVersion             2501

Relationships
  LICENSED_UNDER             2501
  MAINTAINED_BY              577
  DEPENDS_ON (direct)        181
  DEPENDS_ON (transitive)    9437
  AFFECTS                    78
  SUPERSEDED_BY              5

✓ Loaded.
```

The load is **idempotent** — every statement merges on a natural key, so running
it twice produces the same graph rather than a doubled one. If it fails
part-way, just run it again.

To wipe and reload from scratch:

```bash
npm run db:reset
```

## 7. Run the application

```bash
npm run dev
```

Open <http://localhost:3000>. The lamp in the top-right reports the connection
and the round-trip time.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| *No database is connected yet* | `.env.local` missing, or still says `REPLACE_ME` | Steps 3–4 |
| *Cannot reach the database* | Instance paused, wrong URI, or DNS not resolving | Check the console; re-copy the URI |
| *The database refused these credentials* | Wrong password, or the instance was recreated | Rotate the password in the console, update `.env.local` |
| *The database did not answer in time* | Free-tier cold start | Retry; the first request after an idle period is slow |
| Seed fails half-way | Connection dropped | Re-run `npm run db:seed`; it merges rather than duplicates |
| App works, but every sheet is empty | Connected to the right instance, never seeded | `npm run db:seed` |

For problems with CognoDB Cloud itself (signup, provisioning, connectivity) the
assignment gives **cognodb@wexa.ai** as the contact.

---

## Running the database locally instead

If you would rather develop against something on your own machine — or need to
demo without a network — the repo ships a compose file with a Bolt-compatible
Neo4j:

```bash
docker compose up -d
```

Then in `.env.local`:

```dotenv
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=understory-local
```

Everything else is identical: `npm run db:seed`, then `npm run dev`. The
application does not know or care which one it is talking to — that is the point
of speaking Bolt and openCypher rather than a vendor SDK.

---

## Before you submit

The assignment asks you to **keep the instance running until you hear back**, so
the reviewers can try the app against live data. Do not delete it after
recording the demo.
