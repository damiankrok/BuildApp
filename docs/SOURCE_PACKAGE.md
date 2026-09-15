# SourcePackage — acquiring a project's public sources

> `buildapp.source-package` **1.0.0** · `packages/source-package`
> Introduced in STAGE BUILDAPP-02.

A **SourcePackage** is the sealed, content-addressed result of acquiring one
project's published sources: what was fetched, what each asset IS, what the
publisher printed in words, and what did not work. It carries no geometry, no
metres and nothing three-dimensional. It is the only way anything downstream —
the CLI, the analyzer, BuildWorld — ever sees a publisher's material.

## Why there is exactly one acquisition path

A browser that scrapes a page and a CLI that scrapes the same page will
disagree, eventually and silently: different user agents, different lazy-load
attributes, different redirects, a CDN that serves one of them a smaller copy.
By the time the disagreement shows up it is a reconstruction that does not
match what the user is looking at, and there is nothing in the record to
explain it.

So acquisition happens once, in Node, in `acquireSourcePackage`, and everything
else reads the sealed result. `tests/architecture/analyzer.test.ts` enforces
this by name: there is exactly one function in the repository that produces a
SourcePackage, the web app imports neither the acquisition package nor the
analyzer, and no file under `apps/web/src` calls `fetch` or decodes an image.

## The rule the schema exists to enforce

**Decoded pixel dimensions come from the image bytes, never from an HTML
attribute.**

That is not hypothetical. On the live benchmark page the section is served with
`width="400" height="300"` and really is 400×300, while the front elevation is
served with `height="213"` and its bytes are 256 tall. A pipeline that believes
the markup mis-scales every measurement taken off that drawing, and does so
without a symptom. So `SourceVariant.decoded` is what the bytes decode to,
`SourceVariant.declared` is whatever the page claimed, and `declaredMismatch`
records that they disagreed. Nothing downstream may use `declared` for anything.

## Shape

```text
SourcePackage
├── schema / schemaVersion / id / canonicalUrl / pageHash
├── project { externalId?, name?, publisher }
├── adapter { id, version }
├── assets[]                     one logical drawing or picture
│   ├── roles { document, storey, annotation, view, projection }
│   ├── roleEvidence[]           why each role was assigned
│   ├── variants[]               every encoding found, best first
│   │   ├── url, mediaType, byteLength, byteHash
│   │   ├── decoded { width, height }      ← from the bytes
│   │   ├── declared { width?, height? }   ← from the markup, never used
│   │   └── declaredMismatch, aspect
│   ├── selectedVariantId + selectionReason
├── publishedFacts[]             aggregates, never dimensions
├── publishedRooms[]
├── failures[]                   what did NOT work is part of the package
└── contentHash
```

## Roles are five independent dimensions

A drawing is not "a plan" — it is a plan **of the ground floor**, annotated
**with a room table**, in **orthographic plan** projection, with no meaningful
view direction. Collapsing that into one label loses the distinction that
matters most in practice: the same storey is published twice, once with the
dimension chains and once with the area table, and a stage that wants printed
dimensions must get the first. `selectAsset` ranks on exactly that.

Each dimension may be **UNKNOWN** on its own, and `NOT_APPLICABLE` is a
different answer from `UNKNOWN`. When a publisher labels both side elevations
identically, the view role is **SIDE_UNSPECIFIED** — not a guessed LEFT.
A guessed class is worse than an honest UNKNOWN, because a later stage cannot
tell them apart.

## Variants, and what is not one

Two encodings of the same drawing at different resolutions are variants of one
asset. A differently CROPPED drawing is not: measuring a crop as though it were
the whole sheet misplaces every coordinate on it, so a variant whose aspect
differs from the highest-trust copy by more than `ASPECT_TOLERANCE` (2 %) is
split off as its own asset with a recorded reason.

The same bytes published at two addresses are ONE variant. On the live
benchmark the publisher serves each original both under a descriptive name and
under a content-hashed one; counting them twice turned four elevations into
eight. Grouping unions by byte hash and records a `BYTE_IDENTICAL` failure
naming the address that was dropped.

Selection is **on measured pixels**: discover generously, fetch, DECODE, group,
then choose. Choosing before measuring is choosing on a filename.

## Adapters

An adapter knows one publisher: which URLs are its project pages, where its
assets hide, what its filenames mean, and how to read its published figures.
Everything it returns is a CLAIM with evidence and a confidence;
`mergeRoleClaims` resolves each role dimension independently, and two equally
confident claims that DISAGREE leave the dimension UNKNOWN with the conflict
recorded — they do not average.

The one adapter that ships (`archon.pl`) also contributes a **resolution
convention**: its page copies are `…__<n>` and its originals `…__<n+11000>`. A
convention is a hypothesis, so it costs one request, and a 404 is recorded as a
failure — positive evidence that no larger copy is published. Under it the
section resolves from 400×300 to 1138×854, eight times the pixels.

## Safe networking

Acquisition fetches public pages on a user's behalf, which is the shape of a
server-side request forgery if it is not constrained. `net.ts` enforces:

- **HTTPS only**, and a URL carrying credentials is refused before its host is
  even looked at.
- **Every host is resolved and every address classified** — loopback, private,
  link-local (including cloud metadata at 169.254.169.254), carrier-grade NAT,
  multicast, the unspecified address, and every IPv6 spelling of those. An
  IPv4 address embedded in an IPv6 one is classified by the IPv4 address it
  carries, in the dotted form, the compressed hex form that `dns.lookup`
  actually returns, the fully expanded form, the deprecated IPv4-compatible
  form and NAT64.
- **Redirects are followed manually and re-validated at every hop**, because a
  public host that redirects into a private one is the standard bypass.
- **Bounded** — redirect count, request timeout, response bytes (streamed and
  cut at the cap rather than trusting `content-length`), asset count, and a
  media-type allowlist.
- **Anonymous** — `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, no
  cookie jar, nothing replayed from the environment.

Every refusal is a typed `FetchRefused` with a code, and every refusal that
happens during an acquisition lands in `failures[]` rather than shrinking the
package silently. The SSRF tests assert the refusals without contacting
anything private: the resolver is injected.

## Replay

`--cache <dir>` stores fetched bytes under the hash of their URL; `--offline`
refuses the network entirely and rebuilds the package from the cache. With a
populated cache the same package comes back byte for byte, which is what makes
a benchmark runnable in CI and an old reconstruction auditable later.

One honest caveat: an address that 404'd online records `HTTP_STATUS` and the
same address offline records `OFFLINE_CACHE_MISS`. Failure codes are hashed, so
a partial cache legitimately produces a different package — and says so.

## The content hash

`sourcePackageContentHash` covers the canonical URL, page hash, project
identity, adapter id and version, and every asset's roles, variants, decoded
sizes, byte hashes and selection. It deliberately EXCLUDES prose that describes
the same facts — `selectionReason`, `roleEvidence`, failure `message`,
`discoveredVia` — and the package's own id and hash. Two acquisitions that
found the same material hash the same however they narrate it; two that found
different material never do.

## CLI

```bash
npm run source:acquire -- <url> [--out file] [--cache dir] [--offline] [--no-probe]
```

Prints the asset table, the published figures and a summary of what did not
work; writes the sealed package with `--out`.
