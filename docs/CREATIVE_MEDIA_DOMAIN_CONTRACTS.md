# SignalFlow Studio — Creative Media Domain Contracts

> **Status:** target domain/application contract for media intent, asset permissions, image composition, carousels, uploaded-footage editing, media decisions and exact media revisions. Current implementation remains governed by `CAPABILITY_MATRIX.md`.

## 1. Why this contract exists

SignalFlow accepts source material whose meaning cannot be inferred from MIME type alone.

A user may upload the same JPEG for very different purposes:

- visual reference only;
- evidence that should never appear publicly;
- final image candidate;
- source for an edit;
- one input to a composite;
- style inspiration;
- brand material.

The domain must therefore represent **intent, permission, production plan and revision lineage** separately from file bytes.

## 2. Core aggregate relationships

```text
ContentPiece / DirectCreateRequest
        ↓
MediaIntentResolution
        ↓
AssetRoleBinding + AssetUsePolicy
        ↓
MediaDecision
        ↓
MediaRequirement
        ↓
MediaPlan
        ↓
 ┌───────────────┬──────────────────┬───────────────────┐
 │               │                  │                   │
ImagePlan   CarouselPlan      VideoEditPlan       CaptureRecipe
 │               │                  │                   │
 └───────────────┴──────────────────┴───────────────────┘
        ↓
MediaComposition / derived Asset revisions
        ↓
MediaReview / Approval
        ↓
PlatformVariant / PublicationRequest
```

## 3. `DirectCreateRequest`

Represents a user who already knows approximately what they want to create.

Suggested fields:

```text
directCreateRequestId
workspaceId
projectId?
userId
instruction
attachedAssetIds[]
sourceRefs[]
requestedDestinations[]?
requestedFormat?
processingPolicyId
createdAt
status
```

This is an intake record, not the final campaign or render specification.

A Direct Create flow may produce a `ContentSignal`, `ContentOpportunity`, `NarrativeStrategy`, or directly a `ContentPiece` depending on how much editorial interpretation is needed. Application services decide the transition rather than UI components mutating campaign data directly.

## 4. `MediaIntentResolution`

Captures how the user's request and attached assets were interpreted.

```text
mediaIntentResolutionId
workspaceId
projectId?
contentPieceId?
directCreateRequestId?
sourceInstruction
resolvedOutcome
assetBindings[]
explicitConstraints[]
inferredConstraints[]
ambiguities[]
confidence
resolverRunId?
resolvedAt
```

### Invariants

- explicit user constraints are preserved verbatim as provenance;
- inferred constraints are distinguishable from explicit ones;
- low-confidence high-risk interpretation cannot authorize public use or identity-sensitive transformation;
- updating interpretation creates a new revision/audit event rather than rewriting history silently.

## 5. `AssetRoleBinding`

Roles are request/content-piece scoped. One canonical Asset may play different roles in different campaigns.

```text
assetRoleBindingId
assetId
assetVersionId
workspaceId
contentPieceId?
directCreateRequestId?
roles[]
priority?
instructions[]
createdAt
updatedAt
```

Initial role vocabulary:

```text
REFERENCE_ONLY
STYLE_REFERENCE
EVIDENCE
FINAL_CANDIDATE
EDIT_SOURCE
COMPOSITE_SOURCE
BRAND_ASSET
FOOTAGE_SOURCE
AUDIO_SOURCE
VOICE_SOURCE
BACKGROUND_SOURCE
THUMBNAIL_SOURCE
CAPTURE_OUTPUT
GENERATED_SOURCE
DERIVED_OUTPUT
```

### Invariants

- `REFERENCE_ONLY` alone cannot be selected as a publication media binding;
- `EVIDENCE` does not imply public-use permission;
- roles do not override stronger `AssetUsePolicy` restrictions;
- a derived asset receives its own role bindings where required.

## 6. `AssetUsePolicy`

Represents media-specific usage restrictions in addition to workspace/source `ProcessingPolicy`.

```text
assetUsePolicyId
assetId
workspaceId
publicUseAllowed
aiInspectionAllowed
remoteAiInspectionAllowed
editingAllowed
croppingAllowed
compositingAllowed
generationReferenceAllowed
styleReferenceAllowed
faceModificationAllowed
voiceSynthesisAllowed
reuseAcrossCampaignsAllowed
retentionPolicyRef?
rightsStatus
rightsMetadata?
policyVersion
createdBy
createdAt
updatedAt
```

Possible `rightsStatus` values:

```text
USER_CREATED
ORGANIZATION_OWNED
CLIENT_OWNED_WITH_PERMISSION
LICENSED
PUBLIC_DOMAIN_OR_COMPATIBLE
GENERATED
UNKNOWN
RESTRICTED
```

### Policy evaluation rule

Effective permission is the intersection of:

```text
workspace/project ProcessingPolicy
∩ source classification
∩ AssetUsePolicy
∩ user/actor authorization
∩ provider/processor policy
∩ destination requirements
```

The most restrictive applicable rule wins.

## 7. Original and derived assets

Original assets are immutable source versions.

Suggested lineage fields on derived records:

```text
parentAssetVersionIds[]
derivationKind
transformationPlanRef
processorRunRefs[]
modelRunRefs[]
rendererVersion?
contentHash
createdAt
```

Derivation kinds may include:

```text
CROP
RESIZE
BACKGROUND_REMOVAL
CLEANUP
GENERATIVE_EDIT
COMPOSITE
CAROUSEL_SLIDE_RENDER
THUMBNAIL
VIDEO_TRIM
VIDEO_COMPOSITION
CAPTIONED_VIDEO
AUDIO_DERIVATIVE
SCREENSHOT_CAPTURE
SCREENCAST_CAPTURE
```

No mutation API should overwrite original bytes.

## 8. `MediaDecision`

Represents the decision about which media form, if any, is appropriate for a ContentPiece/destination family.

```text
mediaDecisionId
contentPieceId
revision
candidateOptions[]
selectedOption
reasoningSummary
userOverride?
sourceEvidenceRefs[]
assetAvailabilitySnapshot
policySnapshot
costClass
createdBy
createdAt
```

Candidate kinds:

```text
NONE
EXISTING_SINGLE_IMAGE
EDITED_IMAGE
GENERATED_IMAGE
COMPOSITE_IMAGE
DIAGRAM
INFOGRAPHIC
CAROUSEL
PRODUCT_SCREENSHOT
PRODUCT_DEMO_VIDEO
UPLOADED_FOOTAGE_EDIT
REEL_OR_SHORT
LONGER_VIDEO
THUMBNAIL
AUDIO_OR_VOICEOVER
```

### Invariants

- `NONE` is a valid successful decision;
- explicit user choice overrides recommendation unless blocked by safety/privacy/rights;
- a destination can be absent entirely;
- recommendation reasoning must be stored as concise explainable state, not hidden only in model chain-of-thought;
- cost/availability cannot silently weaken privacy.

## 9. `MediaRequirement`

Defines the media outcome independently of production method.

```text
mediaRequirementId
campaignId?
contentPieceId
revision
purpose
recommendedKind
requiredEvidenceRefs[]
assetRoleBindingIds[]
mustShow[]
mustAvoid[]
transformationConstraints[]
preferredAspectRatios[]
durationTarget?
slideCountRange?
generationAllowed
editingAllowed
compositingAllowed
captureAllowed
reusePreference
priority
status
```

Status candidates:

```text
DRAFT
READY_FOR_PLANNING
BLOCKED_POLICY
BLOCKED_ASSETS
PLANNED
IN_PRODUCTION
READY_FOR_REVIEW
APPROVED
REJECTED
CANCELLED
```

## 10. `MediaPlan`

Defines production orchestration for one requirement.

```text
mediaPlanId
mediaRequirementId
revision
productionMethod
sourceAssetVersionIds[]
steps[]
inferenceTasks[]
processorTasks[]
renderTasks[]
captureRecipeId?
imageCompositionPlanId?
carouselCompositionPlanId?
videoEditPlanId?
renderTargets[]
estimatedCost?
processingPolicySnapshot
rightsPolicySnapshot
status
createdAt
```

### Production methods

```text
REUSE_EXISTING
DETERMINISTIC_IMAGE_TRANSFORM
GENERATIVE_IMAGE_EDIT
GENERATE_IMAGE
DETERMINISTIC_IMAGE_COMPOSITION
CAROUSEL_RENDER
AUTOMATIC_PRODUCT_CAPTURE
UPLOADED_FOOTAGE_EDIT
VIDEO_COMPOSITION
HYBRID
```

## 11. `ImageCompositionPlan`

```text
imageCompositionPlanId
mediaRequirementId
contentPieceId
revision
purpose
canvasTargets[]
layers[]
textElements[]
brandProfileRef?
sourceAssetVersionIds[]
generativeTasks[]
deterministicTransforms[]
status
```

Layer model:

```text
layerId
kind
sourceAssetVersionId?
positionRule
sizeRule
cropRule?
maskRef?
effects[]
textStyleRef?
zIndex
visibility
```

### Invariants

- exact UI screenshots used as factual evidence should not be generatively altered unless explicitly allowed and clearly treated as illustrative;
- deterministic composition is preferred for typography/product screenshots;
- generative layer output creates a new derived asset with provenance.

## 12. `CarouselCompositionPlan`

```text
carouselCompositionPlanId
mediaRequirementId
contentPieceId
revision
purpose
aspectRatio
slideCount
slides[]
visualSystemRef
brandProfileRef?
sourceAssetVersionIds[]
renderTargets[]
status
```

### Slide contract

```text
slideId
order
semanticRole
headline
body
visualBinding?
sourceEvidenceRefs[]
layoutPrimitive
accessibilityText?
notes?
```

Semantic roles:

```text
HOOK
STATEMENT
PROBLEM
INSIGHT
PROCESS
SCREENSHOT
DIAGRAM
COMPARISON
BEFORE_AFTER
METRIC
QUOTE
LIST
TIMELINE
CODE
CLOSING
CTA
```

### Invariants

- slide IDs remain stable across edits where the slide identity remains the same;
- reordering does not regenerate unrelated content;
- changing visual binding does not rewrite copy by default;
- changing one slide invalidates approval only for affected derived carousel revision, not unrelated content pieces;
- final publication binds the exact rendered carousel revision.

## 13. `VideoNarrative`

Separates story meaning from timeline mechanics.

```text
videoNarrativeId
contentPieceId
mediaRequirementId
revision
purpose
hook
beats[]
requiredMoments[]
optionalMoments[]
closing
voiceoverIntent?
captionIntent
brandTone?
```

## 14. `VideoEditPlan`

```text
videoEditPlanId
mediaRequirementId
contentPieceId
revision
purpose
durationTarget
aspectRatio
sourceClipBindings[]
timeline[]
captionTrack?
audioPolicy
transitionPolicy
brandProfileRef?
coverPlan?
renderVariants[]
status
```

Timeline item:

```text
timelineItemId
start
end
sourceAssetVersionId
sourceIn
sourceOut
cropRule?
focusRule?
speed
transitionIn?
transitionOut?
overlays[]
captionSegmentRefs[]
audioGain?
```

### Invariants

- timeline references immutable source versions;
- draft edits produce a new plan revision;
- final render can be reproduced from the plan + source versions + renderer version;
- natural-language change requests must become explicit plan mutations;
- rendered output is a derived Asset/MediaComposition, not the authoritative editable state.

## 15. `CaptionTrack`

```text
captionTrackId
language
segments[]
styleRef
sourceTranscriptRef?
reviewState
```

Segment:

```text
start
end
text
speaker?
emphasis[]
```

Machine transcription may remain unapproved until corrected where accuracy matters.

## 16. `AudioPolicy`

```text
audioPolicyId
sourceAudioMode
musicAssetIds[]
voiceoverMode
voiceAssetRef?
duckingPolicy?
targetLoudness?
rightsVerified
```

Voiceover modes:

```text
NONE
USER_RECORDED
GENERIC_SYNTHETIC
USER_APPROVED_SYNTHETIC_VOICE
```

Identity-sensitive modes require stronger consent and capability policy.

## 17. `MediaComposition`

Represents one reviewable rendered output revision.

```text
mediaCompositionId
mediaPlanId
revision
kind
sourcePlanRevisionRefs[]
sourceAssetVersionIds[]
outputAssetVersionIds[]
renderJobId?
providerRunRefs[]
status
qualityReviewState
privacyReviewState
rightsReviewState
createdAt
```

Kinds can include:

```text
STATIC_IMAGE
CAROUSEL
VIDEO
THUMBNAIL
AUDIO
```

## 18. Review state

Suggested states:

```text
NOT_REVIEWED
NEEDS_CHANGES
BLOCKED_PRIVACY
BLOCKED_RIGHTS
BLOCKED_QUALITY
READY_FOR_APPROVAL
APPROVED
REJECTED
SUPERSEDED
```

Approval belongs to exact composition revision/output versions.

## 19. Media approval

Suggested `MediaApproval`:

```text
mediaApprovalId
mediaCompositionId
mediaCompositionRevision
outputAssetVersionIds[]
actorId
approvedAt
policySnapshot
```

A later composition revision cannot inherit this approval silently.

## 20. Publication binding

`PublicationRequest` references exact media outputs.

```text
publicationRequest
  textRevisionId
  mediaApprovalIds[]
  outputAssetVersionIds[]
  destinationTarget
  schedule
  idempotencyKey
```

The publication job must not resolve `latest media` at execution time.

## 21. Natural-language change requests

Change requests should produce structured operations.

Examples:

```text
"slide 4 is too technical"
→ update CarouselSlide(slide4).body/headline
```

```text
"use clip 3 first"
→ reorder VideoEditPlan timeline
```

```text
"remove background but keep the person unchanged"
→ IMAGE_EDIT task with explicit preservation constraint
```

```text
"these photos were only references"
→ revise AssetRoleBinding + re-evaluate dependent MediaPlans
```

All dependent outputs become stale/superseded explicitly.

## 22. Dependency graph

Media application services should maintain dependency relationships such as:

```text
AssetVersion
 → MediaPlan
 → CompositionPlan revision
 → RenderJob
 → MediaComposition revision
 → MediaApproval
 → PublicationRequest
```

If a source/plan changes, dependent state becomes stale rather than silently mutating history.

## 23. Application services

Candidate services:

```text
resolveMediaIntent()
setAssetRole()
setAssetUsePolicy()
recommendMediaFormat()
createMediaRequirement()
planMediaProduction()
requestImageEdit()
requestImageGeneration()
requestImageComposition()
createCarouselPlan()
reviseCarouselSlide()
createVideoNarrative()
createVideoEditPlan()
reviseVideoEditPlan()
requestMediaRender()
reviewMediaComposition()
approveMediaRevision()
rejectMediaRevision()
bindApprovedMediaToPublication()
```

UI, MCP, mobile and workers call application services rather than writing records directly.

## 24. Port boundaries

Infrastructure ports may include:

```text
MediaAssetRepositoryPort
MediaPlanRepositoryPort
MediaRendererPort
ImageProcessorPort
VideoProcessorPort
TranscriptionPort
InferencePort
ObjectStoragePort
JobPort
RightsMetadataPort
```

Provider SDKs stay behind adapters.

## 25. Job model

Long-running media operations use durable jobs.

Job kinds may include:

```text
IMAGE_EDIT
IMAGE_GENERATE
IMAGE_COMPOSE
CAROUSEL_RENDER
VIDEO_ANALYZE
VIDEO_TRANSCRIBE
VIDEO_RENDER
THUMBNAIL_RENDER
CAPTURE
```

Persistent states:

```text
QUEUED
PREPARING
RUNNING
UPLOADING
PROCESSING
SUCCEEDED
PARTIALLY_SUCCEEDED
FAILED
CANCELLED
EXPIRED
```

## 26. Idempotency

Each deterministic/side-effectful job should have an idempotency identity based on appropriate inputs:

```text
job kind
plan revision
source asset hashes
renderer/processor version
output target
```

Retry must not create uncontrolled duplicate canonical outputs.

## 27. Capability discovery

Target capability groups may eventually expose:

```text
media.intentResolution
media.imageUnderstanding
media.imageEditing
media.imageGeneration
media.imageComposition
media.carouselPlanning
media.carouselRendering
media.videoUnderstanding
media.videoEditing
media.videoRendering
media.transcription
media.capture
media.supportedAspectRatios
media.localOnlySupport
```

Documentation does not make these capabilities available. Capability fields should ship only with schema/implementation/tests.

## 28. Data classification and privacy

Media records inherit/reference:

- workspace/project policy;
- source classification;
- asset-level policy;
- provider route provenance.

Examples:

```text
LOCAL_ONLY + IMAGE_UNDERSTANDING
→ local/private inference only
```

```text
REFERENCE_ONLY + publicUseAllowed=false
→ renderer/publication refuses direct source binding
```

```text
CONFIDENTIAL + remoteAiInspectionAllowed=false
→ remote vision task denied
```

## 29. Rights and consent checks

Rights review may be required before final approval/publication when:

- source origin is unknown;
- music license is unclear;
- client-owned material is used;
- stock usage terms restrict destination/commercial use;
- generated media provider terms require metadata/conditions;
- real-person face/voice transformation is requested.

## 30. Identity-sensitive media capabilities

Treat these separately from generic image/video edits:

```text
FACE_MATERIAL_EDIT
FACE_REPLACEMENT
VOICE_CLONING
LIP_SYNC
AVATAR_GENERATION
```

They require explicit user authorization/policy and should not be inferred from vague instructions like "make this better".

## 31. Reuse and derivatives

A master composition may generate destination derivatives.

```text
master-video
  → 16:9
  → 9:16
  → 1:1
  → cover
```

Derivatives must record crop/focal rules and destination-specific layout changes.

If the destination version changes story meaning materially, it should be modeled as a distinct composition/variant rather than a blind derivative.

## 32. Migration strategy

Do not migrate existing campaign Assets into new roles by guessing unsafe public-use permissions.

Suggested safe migration:

- existing canonical Asset remains valid;
- create role bindings only when a new workflow requires them;
- default unknown legacy role to `UNSPECIFIED`/needs interpretation rather than `FINAL_CANDIDATE`;
- default public-use permission conservatively based on existing explicit use where evidence exists;
- preserve old campaigns/export compatibility;
- add schema versions before persistent cloud migration.

## 33. Serialization/export

Portable exports should eventually include:

- asset metadata/lineage;
- role bindings;
- use policies where user-owned;
- media requirements/plans;
- carousel/video/image editable plan state;
- composition revisions;
- approvals;
- rights metadata.

Raw binary inclusion remains governed by archive format/size/storage design.

## 34. Deletion/retention

Deleting a source asset must account for:

- derived assets;
- active media plans;
- published historical provenance;
- legal/rights retention rules;
- remote object deletion;
- local cache/proxy cleanup;
- generated provider retention according to processing policy.

Do not leave user-deleted originals in unmanaged processing caches.

## 35. Observability

Safe logs can contain:

- IDs;
- job state;
- processor/model identifiers;
- duration/cost;
- file size/type/dimensions;
- hashes where safe;
- failure classifications.

Do not log:

- raw private images/video;
- full transcripts from confidential media;
- secrets;
- private signed URLs;
- face/voice embeddings;
- full user creative instructions where sensitive.

## 36. Testing layers

Required tests vary by slice but should include:

### Domain

- role/policy precedence;
- immutable originals;
- lineage;
- stale dependency invalidation;
- exact revision approval.

### Provider/inference

- capability routing;
- privacy denial;
- invalid output handling;
- fallback without privacy downgrade.

### Image

- crop/resize/composition dimensions;
- source preservation;
- edit provenance;
- policy restrictions.

### Carousel

- stable slide IDs;
- slide-level revisions;
- render order;
- aspect-ratio fixtures;
- typography overflow.

### Video

- timeline validation;
- clip bounds;
- caption timing;
- render reproducibility;
- cancellation/retry;
- large media/proxy behavior.

### Publication

- exact media revision binding;
- stale approval rejection;
- destination capability mismatch;
- idempotent retries.

## 37. Completion principle

> **Media is complete only when intent, permission, editable structure, production, provenance, review and exact approval all agree.**

An attractive rendered file alone is not a completed SignalFlow media feature.
