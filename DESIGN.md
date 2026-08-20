# Design system

<!-- Recorded from the built interface, not written ahead of it. Every value
     here was measured in the shipped CSS or the rendered page. -->

## The world

Understory is drawn as a **telephone-exchange cable record**: the sheet an
engineer pulls to trace a fault back through the plant, past each distribution
frame, to the pair that failed.

The fit is not decorative. Tracing a run through a cable plant is structurally
the same job the product does — *which subscribers does this failed pair reach,
and at which frame do I re-jumper to cut it?* — and the artefact has native
vocabulary for everything the interface needs: a title block for provenance, a
schedule for quantities, terminal blocks for nodes, a jumper for the traced
route, and a legible way to say *no route found*.

**What it refuses.** The security-dashboard arrangement: near-black ground, neon
severity chips, a donut of severity counts, a table of CVEs, a violet accent.
That layout answers *how bad*. This product answers *how did it get here*.

## Colour

Everything is OKLCH, defined once in `src/app/globals.css` under `@theme`.

### Stock (light) — the default

| Token | Value | Role |
|---|---|---|
| `--color-stock` | `oklch(0.957 0.011 116)` | Ground. Pale drafting buff. |
| `--color-stock-sunk` | `oklch(0.934 0.013 114)` | Recessed bands, table heads, hover. |
| `--color-sheet` | `oklch(0.988 0.005 116)` | The drawing surface. |
| `--color-ink` | `oklch(0.243 0.021 249)` | Primary text and linework. |
| `--color-ink-2` | `oklch(0.418 0.020 249)` | Body prose. |
| `--color-ink-3` | `oklch(0.502 0.019 249)` | Field labels, annotation. |
| `--color-rule` | `oklch(0.828 0.014 245)` | Sheet borders. |
| `--color-rule-strong` | `oklch(0.615 0.020 245)` | Control borders, the run rail. |
| `--color-rule-hair` | `oklch(0.872 0.011 245)` | Row separators. |
| `--color-jumper` | `oklch(0.532 0.194 30)` | **The traced route, and nothing else.** |

### Negative (dark) — the reprographer's print

Not an inversion. The blue ground carries its own chroma, the linework gains
weight, and secondary text is tinted from the ground's hue rather than dropped to
grey.

| Token | Value |
|---|---|
| `--color-stock` | `oklch(0.252 0.043 252)` |
| `--color-sheet` | `oklch(0.296 0.041 252)` |
| `--color-ink` | `oklch(0.968 0.010 250)` |
| `--color-jumper` | `oklch(0.712 0.171 39)` |
| `--color-on-jumper` | `oklch(0.205 0.040 40)` — flips, because the jumper does |

### The colour strategy

**Committed, with one accent held in reserve.** The drafting stock owns the whole
ground; ink owns the linework; and exactly one saturated colour — jumper
vermilion — is spent on the traced route and nothing else. When a run is drawn
to a fault, the rail itself turns vermilion. That is the thesis rendered in
colour: the only thing shouting on any screen is the answer to the question that
was asked.

### Fault classes

Severity is carried **three ways at once** — a stencilled letter, a fill weight,
and a colour — so the class survives a monochrome print, a colour-blind reader,
and a screenshot pasted into a ticket. Critical and high are filled; medium and
low are outlined.

| Class | Mark | Stock | Negative |
|---|---|---|---|
| Critical | filled `C` | `oklch(0.468 0.190 24)` | `oklch(0.700 0.184 24)` |
| High | filled `H` | `oklch(0.516 0.148 52)` | `oklch(0.760 0.140 62)` |
| Medium | outlined `M` | `oklch(0.502 0.101 88)` | `oklch(0.810 0.118 92)` |
| Low | outlined `L` | `oklch(0.486 0.065 236)` | `oklch(0.775 0.070 232)` |
| Clear | check glyph | `oklch(0.455 0.088 162)` | `oklch(0.780 0.106 164)` |

### Contrast

Every foreground/background pair in both themes was computed rather than
eyeballed. Body text clears 4.5:1 on every ground; control borders clear 3:1.
The tightest pairs that ship:

| Pair | Ratio |
|---|---|
| `ink-3` on `stock-sunk` (stock) | 4.90 |
| `jumper` on `stock-sunk` (stock) | 4.77 |
| `rule-strong` on `stock` (stock) | 3.28 |
| `sheet` on `fault-critical` (negative) | 4.76 |
| `on-jumper` on `jumper` (negative) | 6.62 |

## Type

Three families, each doing a job no other can.

| Role | Family | Spec |
|---|---|---|
| Display, field labels | **Barlow Condensed** 600/700 | uppercase, `0.11em` tracking, `1.35` leading. Headings run `clamp(1.9rem, 4.6vw, 3.1rem)` at `0.96` leading. |
| Prose | **Public Sans Variable** | 16px / 1.65. Measure held at 48–58ch. |
| Identifiers, measurements, code | **JetBrains Mono Variable** | 12–13px, tabular figures, `zero` feature on. |

Barlow Condensed was drawn for public-infrastructure signage; Public Sans is an
institutional workhorse with real tabular numerals; the mono carries package
identifiers, version ranges, and the Cypher in the disclosure — code and
measurement, never costume.

All three are self-hosted through Fontsource, so there is no build-time or
runtime request to a font CDN.

**Two roles that look like labels but are not.** Package roles ("Schema
declaration and validation") and application metadata ("Payments · Tier 1 ·
Node 20") are annotation, so they render in mono sentence case rather than
tracked uppercase. Tracked uppercase is reserved for things that name a *field*.

## Structure

- **Radii:** 0 on structure, 2px on controls. Nothing above 4px.
- **Elevation is declared once, as a rule.** There are no surface shadows in this
  system — a drawing is flat, and hierarchy comes from line weight and space. The
  single exception is the search panel, which floats over the sheet and gets a
  real offset-and-blur shadow.
- **Spacing** runs on Tailwind's 4px scale. Tight inside a group, generous
  between groups, more space above a heading than below it.
- **Rows are separated by hairlines, never wrapped in cards.** There is no
  card-grid page structure anywhere in the application.
- **Every sheet has a field header** — a stencilled label, an optional count, an
  optional action — and every page ends in a **title block** carrying the record,
  the sheet number, the traversal bound, the instance, and the synthetic-data
  stamp. Provenance lives where a reader of a drawing looks for it.

## Motion

**One authored moment: the jumper runs itself down the sheet.** The rail scales
from zero over 640ms on an exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`),
and the terminal blocks settle in behind it on an 80ms stagger.

Two rules hold everywhere else:

1. **Nothing is hidden waiting for an animation to reveal it.** Every block is
   present and legible from the first frame; only position animates, never
   opacity or blur. A screenshot taken mid-animation shows the same content as
   one taken after.
2. **`prefers-reduced-motion` removes the animation, not the content.**

## Browser surfaces

The parts nobody draws still carry the design: text selection, the caret, the
scrollbar track and thumb, focus rings, underline offset, and tabular figures in
every data cell are all themed from the palette rather than left at the browser
default.

## Iconography

Sixteen marks on one 16-unit grid, 1.4 stroke, square caps, mitred joins —
technical-drawing vocabulary rather than a UI kit. Authored in
`src/components/icon.tsx`; no icon library, no emoji, no Unicode glyph standing
in for a drawn mark.

## Responsiveness

- The **run diagram is vertical at every width**. A horizontal chain has to wrap
  on a phone, and a wrapped chain destroys the one thing the drawing is for: you
  can see at a glance how far down the run the problem sits.
- Table rows collapse from a grid to a labelled stack below `sm`; the column
  heads become inline field labels rather than disappearing.
- The section nav moves to its own scrollable band below `lg`.
- All filter state lives in the URL, so any view can be sent to somebody else.

## Verification

The interface was scanned at every route with a design anti-pattern detector.
Findings resolved: text overflow, all-caps body runs, kicker-above-heading, tight
leading, sub-12px body text, measured contrast failures, over-long measures, and
em-dash saturation.

The one class of finding left standing is `nested-cards`, which fires on the
search input inside the masthead and on the 7–9px terminal marks and measure
tracks inside sheets. Those are a form control in a header and small drawn marks
inside a drawing — not the "same-size cards of icon plus heading plus text as the
page structure" the rule exists to catch.
