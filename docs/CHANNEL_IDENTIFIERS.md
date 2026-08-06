# Canonical channel identifiers

SignalFlow uses one stable identifier for each destination across the browser UI, API routes, MCP, persistence, generation, quality checks, status, exports, and portable transfer.

## Active identifiers

| Identifier | Display label | Package key | Legacy input aliases |
| --- | --- | --- | --- |
| `linkedin` | LinkedIn | `linkedin` | — |
| `x` | X | `x` | `twitter` |
| `instagram` | Instagram | `instagram` | — |
| `reddit` | Reddit | `reddit` | — |
| `facebook` | Facebook | `facebook` | — |
| `threads` | Threads | `threads` | — |
| `youtube` | YouTube | `youtube` | — |
| `tiktok` | TikTok | `tiktok` | — |
| `hackernews` | Hacker News | `hackernews` | `hn`, `hacker-news`, `hacker_news` |
| `newsletter` | Newsletter | `newsletter` | — |
| `blog` | Blog | `blog` | — |
| `release_notes` | Release notes | `releaseNotes` | `releasenotes`, `release-notes`, `releaseNotes` |

## Contract rules

- New code and persisted records must use only the active identifiers above.
- `hackernews` is the only active internal identifier for Hacker News. `hn` is accepted only at compatibility and migration boundaries.
- API responses, generation status maps, campaign drafts, quality metadata, UI selection state, export paths, and portable records must emit `hackernews`.
- Compatibility readers may accept a legacy alias, but must normalize it before domain logic runs and must never write the alias back.
- Package-key differences are output-shape compatibility only. They do not create a second channel identity.
- A new destination requires an explicit addition to this registry, its generation contract, UI metadata, export projection, status behavior, tests, and capability documentation.

## Current compatibility boundaries

Legacy aliases are intentionally limited to:

- `frontend/lib/domain/campaign.mjs`, where old saved campaigns are migrated into canonical channel keys;
- `frontend/lib/ai/channelGeneration.mjs`, where incoming generation requests are normalized before contract and quality lookup;
- `frontend/lib/export/campaignExport.mjs`, where an old structured package key may be read while the exported campaign remains canonical;
- regression tests and this document.

Any active runtime response or newly persisted record containing `hn` is a defect.