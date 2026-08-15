# SignalFlow Studio — Inference and Client Capability Matrix

> **Status:** current-vs-target truth supplement. This file exists so the new inference/mobile/edge architecture cannot be mistaken for already-shipped functionality. `docs/CAPABILITY_MATRIX.md` remains the broader product capability source; this matrix goes deeper on AI routing and client surfaces.

## Legend

| Status | Meaning |
| --- | --- |
| **Implemented foundation** | Relevant working code/contracts exist today, but may not represent the final target architecture. |
| **Partial / experimental** | Some path exists, but it is not yet a complete production capability. |
| **Planned** | Architecture/issues exist; do not advertise as available. |
| **Later** | Intentionally deferred beyond the initial Personal Alpha proof. |

## Inference

| Capability | Current status | Target/owner |
| --- | --- | --- |
| Real configured text-model providers | **Implemented foundation** | Existing provider adapters / #61 |
| OpenAI-compatible custom/local endpoint routes | **Implemented foundation** | Existing provider adapters |
| Ollama / LM Studio-style local endpoint routes | **Implemented foundation** | Existing provider adapters; future #173 capability registry |
| BYOK/provider configuration | **Implemented foundation / partial** | Existing provider UX; target #170/#171 |
| Provider-neutral `InferenceTask` contract | **Planned** | #171 |
| Capability/policy-aware router | **Planned** | #171 |
| Per-task cost/usage metering | **Planned** | #171 / #106 relationship |
| Cheap/local preprocessing before strong reasoning | **Planned** | #171/#173 |
| Curated downloadable local intelligence pack | **Planned** | #173 |
| SignalFlow Managed inference plan | **Planned** | #170/#171 plus hosted plan work |
| Multimodal provider routing (vision/image edit/generation) | **Planned** | #170 + media architecture |
| Enterprise/customer-controlled inference | **Later** | #170/#55/#64 |

## Privacy and source processing

| Capability | Current status | Target/owner |
| --- | --- | --- |
| Provider keys protected from normal public client exposure | **Implemented foundation** | Existing provider/security architecture |
| Canonical source/asset provenance | **Implemented foundation** | #59/source docs |
| Data classification (`PUBLIC`, `CONFIDENTIAL`, etc.) | **Planned** | #172 |
| Enforced ProcessingPolicy before inference | **Planned** | #172 |
| Private Hybrid raw-local / summary-remote flow | **Planned** | #172/#176 |
| Local Only fail-closed route policy | **Planned** | #172/#173/#176 |
| User-visible explanation of what may leave the device | **Planned** | #172 + client UX |
| Full private-repo upload prohibited by architecture | **Target rule** | #172/source architecture |
| Enterprise private/VPC/on-prem processing | **Later** | #170/#64 |

## External AI clients

| Capability | Current status | Target/owner |
| --- | --- | --- |
| SignalFlow MCP package | **Implemented foundation** | Existing MCP work |
| MCP over canonical Opportunities/Plan/Review | **Planned** | #174 |
| ChatGPT as SignalFlow client through supported integration | **Planned** | #174 |
| Claude as SignalFlow client through supported integration | **Planned** | #174 |
| Codex as SignalFlow client through supported integration | **Planned** | #174 |
| Gemini/other agent as SignalFlow client | **Planned** | #174 |
| Consumer subscription used as generic SignalFlow API credit | **Not a supported architecture** | Explicitly prohibited unless provider later exposes official capability |
| Local Codex/Claude Code-style agent adapter | **Later / optional** | #174/#176 |
| Scraped web session/cookie/OAuth reuse | **Prohibited** | Security architecture |

## Client surfaces

| Client | Current status | Target role |
| --- | --- | --- |
| Web Studio | **Implemented foundation** | Full workspace / Today / Plan / Review / Calendar |
| Browser extension | **Experimental/partial** | Explicit browser context/screenshot/recording capture via #58 |
| Mobile application | **Planned** | Judgment, quick capture, share sheet, approval, calendar, exceptions via #175 |
| Desktop Edge Agent | **Planned** | Private repos/files, local models, Private Hybrid, edge jobs via #176 |
| Desktop application capture | **Later** | Bounded desktop CaptureRecipe via #177 |

## Mobile capabilities

All of the following are **planned**, not current production capabilities unless separately implemented and verified:

- Today inbox on mobile;
- mobile push notifications;
- manual thought/voice-note capture;
- camera/photo input;
- share-sheet links/files/images/video;
- exact revision review/approval;
- Calendar and publication exception recovery;
- optional on-device lightweight AI preprocessing.

Owner: #175.

## Desktop Edge capabilities

All are **planned**:

- paired device identity;
- signed edge jobs;
- explicit local repository/folder roots;
- private-hybrid source preprocessing;
- local model registry/runtime integration;
- optional officially supported local AI-agent adapters;
- device capability reporting;
- secure artifact transfers.

Owner: #176.

Desktop application screenshot/screencast automation is separately deferred to #177.

## Product truth rules

1. A provider adapter existing in code does not mean SignalFlow has managed AI billing/routing.
2. A local endpoint existing does not mean curated local-model download/quality support exists.
3. MCP existing does not mean ChatGPT/Claude/Codex/Gemini integrations are production-ready.
4. An external assistant connection does not mean its subscription can fund unattended SignalFlow inference.
5. A private GitHub repository connection does not by itself guarantee raw code stays local; that guarantee requires ProcessingPolicy/Private Hybrid/Local Only implementation.
6. The mobile and Desktop Agent architecture is target design until #175/#176 acceptance evidence exists.
7. Desktop app capture is later and must never be marketed as current browser capture capability.
8. Future multimodal inference (image editing/generation/video intelligence) must be represented as specialized capability, not assumed from a text model route.
