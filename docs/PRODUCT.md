# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, Tailwind v4, official `neo4j-driver` over Bolt against CognoDB. Chosen by the user from three offered options; one repo, one deploy target (Vercel free tier), no CORS layer.

## Users

**Primary — the person who owns "are we exposed?"** An engineering or platform lead at a 50–500 person software company. An advisory lands in their inbox on a Tuesday. They own maybe a dozen shipping applications and have no idea, without a day of grepping lockfiles, which of them actually reach the flawed code.

**Secondary — the person who has to be told.** An engineering manager, a compliance reviewer, or a customer-security questionnaire responder. They do not read lockfiles and do not write queries. They need the answer and the evidence for it in a form they can forward.

The job in both cases is the same shape: *given a thing I am worried about, show me what it reaches inside my estate, by what route, and what would cut the route.*

## Product Purpose

Understory turns an organisation's dependency graph into something a person can interrogate. It answers reachability questions — which applications a given advisory, package, licence, or maintainer actually touches, and along which chain — and it shows the chain, not just the verdict.

Success is a non-technical visitor arriving on an advisory they have never seen and, without instruction, understanding which of the organisation's applications are exposed, how far away the flawed code sits, and which single dependency upgrade removes the most exposure.

## Positioning

Existing scanners answer *what* is vulnerable. Understory answers *how it got here*: the shortest chain of dependency edges from an application the organisation owns to code it did not write, and the one hop on that chain that would sever it.

Two consequences a table-shaped tool cannot copy:

- **Risk that is not a CVE.** A single unverified maintainer sitting beneath a third of the estate is a real exposure with no advisory ID. So is a copyleft licence that entered through a fourth-level transitive edge. Both are path questions, and both fall out of the same traversal.
- **The "why is this even here" question.** Given an application and any package anywhere beneath it, return the shortest path that explains its presence.

## Operating Context

- Read-only exploration. The application never writes to the graph; the only write path is the seed script, run deliberately from a terminal.
- The graph is hosted on a CognoDB Cloud free (c0) instance: burstable 0.5 vCPU, 256 MB RAM, 1 GB disk, 200 connections. Query and dataset sizing must respect that.
- Reviewers will open a hosted demo link cold, with no briefing, possibly on a phone, and possibly at a moment when the database is asleep or unreachable.
- The visitor may be evaluating the *engineering* as much as the answer: every panel must be able to show the exact parameterised Cypher that produced it.

## Capabilities and Constraints

- Labelled nodes: Application, Package, PackageVersion, Maintainer, Advisory, License.
- Typed relationships: DEPENDS_ON (application→version and version→version, carrying scope and declared range), VERSION_OF, MAINTAINED_BY, AFFECTS, LICENSED_UNDER, SUPERSEDED_BY.
- Every query is parameterised through the official driver. No string-concatenated Cypher anywhere in the codebase, including the seed script.
- Multi-hop traversal is the core mechanic, not a garnish: variable-length paths, shortest-path explanation, and aggregation over reachable sets.
- The application must stay legible when the database is unreachable: a named, recoverable failure state on every surface, never a stack trace and never a blank screen.
- **Data honesty:** package names and ecosystems are real; the organisation, its applications, its maintainer accounts, and every advisory are synthetic and must be labelled as such wherever a visitor could mistake them for real published vulnerabilities. Advisories carry a `USY-` prefix precisely so they cannot be confused with GHSA or CVE identifiers.

## Brand Commitments

Name: **Understory** — the layer of a forest beneath the canopy. The code an organisation ships sits on top; the understory is everything underneath it that somebody else wrote. Terminology follows that: *canopy* is never used as jargon, but "beneath", "depth", "reach", and "path" are the product's own words.

## Evidence on Hand

- The seed script's dataset, authored at full fidelity and labelled synthetic in the UI and README.
- Real, checkable package names and ecosystem conventions (npm/PyPI naming, semver ranges, scope flags).
- No real advisory data, no real customer, no benchmark, no pricing. Future work must not invent any.

## Product Principles

1. **Show the path, not the verdict.** A result the visitor cannot trace is a result they cannot act on or forward.
2. **Depth is the unit of concern.** How far away a risk sits changes what you do about it; the interface should always make distance visible.
3. **The query is part of the product.** Any panel can reveal the exact Cypher and parameters behind it, because the audience includes people judging the engineering.
4. **Legible when broken.** Unreachable database, empty result, cold start, and no-match are designed states with names and recoveries, not accidents.
5. **Never fake authority.** Synthetic data is labelled synthetic, everywhere it could be mistaken for real.

## Accessibility & Inclusion

Reviewers may open the demo on a phone. Every finding must be reachable without a graph canvas — the node-link view is an aid, never the only route to an answer. Colour never carries severity alone.
