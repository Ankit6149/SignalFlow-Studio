from pathlib import Path

path = Path("docs/CAPABILITY_MATRIX.md")
text = path.read_text()

replacements = [
    (
        "| Browser-local manual `ContentSignal` intake/lifecycle | Available | Available | Available | Available |\n",
        "| Browser-local manual `ContentSignal` intake/lifecycle | Available | Available | Available | Available |\n| Explicit high-confidence `Prepare for review` → reviewed Today decision | Available when a permitted model route and explicit Voice are configured | Available when configured | Available when configured | Available when configured |\n",
    ),
    (
        "| Staged generation orchestration | Partially implemented: `opportunity_evaluation` → `narrative_strategy` → destination-specific `platform_variant` writing → separate `evidence_critique` + `authenticity_critique` → exact human review/approval; bounded natural-language exact-revision change requests are implemented; durable jobs and broader stages remain planned | #158/#166 |",
        "| Staged generation orchestration | Implemented browser-local for the owner-triggered high-confidence path: `opportunity_evaluation` → deterministic confidence/escalation policy → provenance-tagged recommended angle → `narrative_strategy` → policy acceptance → destination-specific `platform_variant` writing → separate `evidence_critique` + `authenticity_critique` → Today exact human judgment. Bounded natural-language exact-revision change requests are implemented; durable/background jobs and broader stages remain planned | #158/#166/#206 |",
    ),
    (
        "| Today decision inbox | Implemented browser-local as a derived exact-revision judgment queue over canonical Golden Path records; automatic Signal→review-ready orchestration is still planned | #159/#166/#204 |",
        "| Today decision inbox | Implemented browser-local as a derived exact-revision judgment queue over canonical Golden Path records; explicit owner-triggered high-confidence Signal→review-ready preparation is implemented, while automatic background/connected-source triggers remain planned | #159/#166/#204/#206 |",
    ),
    (
        "| Signals workspace | Implemented for browser-local manual intake/lifecycle + explicit `Find ideas`; automatic connector ingestion still planned | #152/#159/#166 |",
        "| Signals workspace | Implemented for browser-local manual intake/lifecycle + primary `Prepare for review` high-confidence orchestration + explicit `Find ideas` manual recovery; automatic connector/background ingestion still planned | #152/#159/#166/#206 |",
    ),
    (
        "| Owner Golden Path 1 manual thought → authentic approval | In progress: implemented through manual Signal → Opportunity/angle → explicit Voice → approved NarrativeStrategy → ContentPiece → immutable LinkedIn/X revisions → separate evidence/authenticity checks → immutable owner edit/regenerate → exact revision approve/reject; bounded natural-language exact-revision change requests are implemented; feedback/StyleMemory learning remains pending | #166 |",
        "| Owner Golden Path 1 manual thought → authentic approval | Implemented for owner use through both the advanced/manual controls and the explicit high-confidence `Prepare for review` path: manual Signal → Opportunity/confidence gates → provenance-tagged angle/strategy decisions → ContentPiece → immutable LinkedIn/X revisions → separate evidence/authenticity checks → Today → exact owner approve/request-change/reject. Feedback/StyleMemory learning remains pending | #166/#206 |",
    ),
    (
        "The owner-first browser-local path now implements manual `ContentSignal`, persisted `ContentOpportunity` evaluation/angle selection, explicit versioned Identity/Perception/Voice/Boundary context, reviewable/approvable `NarrativeStrategy`, canonical `ContentPiece`/LinkedIn-X `PlatformVariant`, immutable generated/owner-edited/AI-revised `PlatformVariantRevision` history, separate evidence/authenticity critics, and exact per-revision human approve/reject decisions.",
        "The owner-first browser-local path now implements manual `ContentSignal`, persisted `ContentOpportunity` evaluation/angle selection, explicit versioned Identity/Perception/Voice/Boundary context, reviewable/approvable `NarrativeStrategy`, canonical `ContentPiece`/LinkedIn-X `PlatformVariant`, immutable generated/owner-edited/AI-revised `PlatformVariantRevision` history, separate evidence/authenticity critics, exact per-revision human approve/reject decisions, and an explicit high-confidence `Prepare for review` orchestrator that safely composes those stages into the Today decision inbox.",
    ),
    (
        "Automatic signal ingestion, connected-source intelligence, memory-aware opportunity ranking, automatic Signal→review-ready orchestration, StyleMemory, NarrativeMemory, publishing and broader hosted persistence remain target capabilities until their owning issues are complete. The browser-local Today decision inbox is implemented as a derived view over exact reviewed current revisions; it does not create a second workflow state store.",
        "Automatic signal ingestion, connected-source/background triggers, memory-aware opportunity ranking, StyleMemory, NarrativeMemory, publishing and broader hosted persistence remain target capabilities until their owning issues are complete. Explicit owner-triggered high-confidence Signal→review-ready orchestration is implemented browser-local; it escalates uncertain work instead of guessing and never performs final content approval or publishing. The Today decision inbox remains a derived view over exact reviewed current revisions and does not create a second workflow state store.",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"missing expected capability text: {old[:90]}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("patched autopilot capability truth")
