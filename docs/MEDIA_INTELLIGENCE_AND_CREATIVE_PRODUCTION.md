# SignalFlow Studio — Media Intelligence and Creative Production Architecture

> **Status:** canonical target architecture for deciding what media a story needs, understanding user-supplied media intent, transforming images/video, producing carousels and basic creator content, and preserving exact revision/permission/provenance boundaries. This extends `CAPTURE_AND_MEDIA_PRODUCTION.md`; it does not replace its safer deterministic capture architecture.

## 1. Product purpose

SignalFlow is not only a text generator and not only an automatic screenshot recorder.

A user may arrive with any of these intentions:

- "I want to talk about this topic. Decide whether it needs media."
- "Use this image exactly."
- "These images are only references; do not publish them."
- "Clean this image up."
- "Combine these screenshots into one visual."
- "Create a carousel explaining this."
- "Make an Instagram Reel from these clips."
- "Use these clips, remove dead space, add captions and keep it calm."
- "Create a visual because I have no useful image."
- "Use this screenshot as evidence but never expose the confidential parts."
- "Make the same campaign work differently on LinkedIn, X, Instagram and YouTube."

SignalFlow therefore needs a **Media Intelligence layer** between narrative planning and media production.

The user's job remains judgment. SignalFlow should determine and execute the repetitive media work while preserving user intent, authenticity, privacy, ownership and exact approval.

## 2. Core principle

> **First understand what the media means and what the user allows. Then decide what the story needs. Only then choose how to produce it.**

An uploaded image or video is not automatically a publishable asset.

It may be:

- evidence;
- inspiration;
- reference only;
- a final candidate;
- an edit source;
- one layer in a composite;
- raw footage;
- brand material;
- private context that must never appear publicly.

The product must model that difference explicitly.

## 3. Canonical lifecycle

```text
ContentSignal / direct Create request
        ↓
NarrativeStrategy / ContentPiece intent
        ↓
User instruction + attached assets + source evidence
        ↓
Media Intent Resolution
        ↓
AssetRole + AssetUsePolicy
        ↓
Media Decision Engine
        ↓
none / existing / edit / composite / generate / carousel / capture / video edit
        ↓
MediaRequirement
        ↓
MediaPlan
        ↓
production pipeline(s)
        ↓
immutable derived Assets / MediaComposition revisions
        ↓
quality + authenticity + privacy + rights review
        ↓
platform derivatives
        ↓
exact media revision review/approval
        ↓
PublicationRequest binds exact approved text + media
```

No production pipeline may infer permission merely because the user uploaded a file.

## 4. Two entry modes, one production system

SignalFlow has two legitimate user entry patterns.

### 4.1 Editorial / autopilot entry

The user continues real work or submits a thought. SignalFlow decides whether an opportunity deserves content and what media, if any, improves it.

```text
work → signal → opportunity → story → media decision → production
```

### 4.2 Direct Create entry

The user already knows the desired outcome.

Examples:

- make a Reel from these five clips;
- turn this document into a carousel;
- write about XYZ and use these photos only as reference;
- combine these screenshots into one launch graphic;
- edit this photo and make an Instagram post;
- use this video but shorten it to 20–25 seconds.

```text
natural-language request + assets → interpreted creative brief → same canonical media system
```

These are not separate products. They converge on the same `ContentPiece`, `MediaRequirement`, `MediaPlan`, `Asset`, `MediaComposition`, review and approval contracts.

## 5. Media intent resolution

Before media production, SignalFlow resolves the meaning of each supplied asset and the user's requested transformation.

Suggested `MediaIntentResolution` fields:

```text
mediaIntentResolutionId
workspaceId
projectId
contentPieceId?
directCreateRequestId?
sourceMessageRef
assetBindings[]
requestedOutcome
explicitInstructions[]
interpretedInstructions[]
ambiguities[]
confidence
resolvedAt
```

The resolver uses:

- the user's message;
- per-asset annotations;
- upload/share-sheet context;
- platform/destination intent;
- identity and brand boundaries;
- project/workspace privacy policy;
- previous explicit media preferences where applicable.

It must not silently reinterpret a reference-only asset into public content.

## 6. `AssetRole`

Each asset may hold one or more explicit roles scoped to a request/content piece.

Canonical role candidates:

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

Role is not the same as file type.

A PNG may be evidence, final artwork or style reference. A video may be final footage, raw footage, reference or private evidence.

## 7. `AssetUsePolicy`

Asset-level permissions refine workspace `ProcessingPolicy`.

Suggested fields:

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
retentionPolicyRef
rightsStatus
rightsNotes?
createdBy
createdAt
```

### 7.1 Permission hierarchy

```text
safety/legal restrictions
    > explicit asset restrictions
    > workspace/project processing policy
    > explicit user request
    > inferred media intent
    > platform optimization
```

An inference or renderer cannot override a stronger restriction.

### 7.2 Example

A confidential screenshot can be:

```text
role = EVIDENCE
publicUseAllowed = false
remoteAiInspectionAllowed = false
editingAllowed = true locally
```

SignalFlow may derive a safe structured fact locally but may not publish the screenshot or send it to a prohibited remote vision provider.

## 8. Original assets are immutable

SignalFlow must not destructively edit user originals.

```text
original-photo.jpg
   ├─ crop-v1.jpg
   ├─ cleanup-v1.jpg
   ├─ background-removed-v2.png
   └─ carousel-slide-derived-v1.png
```

```text
raw-clip-01.mp4
   ├─ trim-v1.mp4
   ├─ reel-cut-v2.mp4
   └─ vertical-captioned-v3.mp4
```

Every derived artifact records:

- parent asset version(s);
- transformation plan/revision;
- processor/model/renderer provenance;
- user instruction provenance;
- privacy/rights state;
- content hash;
- timestamps;
- approval relationship.

A failed or disliked edit never destroys source media.

## 9. Explicit instruction precedence

SignalFlow recommendations never outrank explicit creative instructions.

Example precedence:

```text
1. explicit user instruction
2. privacy/rights/consent restrictions
3. identity/brand boundaries
4. factual/evidence requirements
5. destination capability/requirements
6. available reusable assets
7. editorial/media recommendation
8. cost and latency optimization
```

Examples:

- "Text only" means do not force a carousel.
- "Use image 2 exactly; crop only" prohibits generative modification.
- "Do not edit my face" blocks face-changing operations.
- "These screenshots are references only" blocks publication of those screenshots.
- "No flashy transitions" becomes a video transition constraint.

## 10. `MediaDecision`

The Editorial Brain and Media Intelligence layer decide the media form before production.

Suggested choices:

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

The decision is destination-aware but not destination-forced.

A content piece may be text-only on one destination, carousel on another, and absent on another.

## 11. Media decision criteria

The decision engine evaluates:

- explicit user request;
- story purpose;
- complexity/sequential explanation value;
- strength of available visual evidence;
- authenticity impact;
- platform culture/capability;
- existing reusable assets;
- production cost;
- opportunity freshness/time sensitivity;
- privacy restrictions;
- rights/licensing;
- narrative repetition;
- prior visual treatment;
- accessibility needs;
- expected derivative/reuse value.

Example structured recommendation:

```text
LinkedIn
  carousel          0.91
  architecture card 0.78
  text only         0.64
  video             0.45

Instagram
  short reel        0.88
  carousel          0.75

YouTube
  defer             0.82
```

Scores must remain explainable enough for the user/application to understand why a format was recommended.

## 12. Media can be unnecessary

SignalFlow must explicitly support `NONE`.

Examples:

- a personal reflection may be more authentic as text;
- a small update may not justify rendering cost;
- available imagery may weaken rather than support the story;
- privacy constraints may make safe visual production impossible;
- a destination may not benefit from media.

The product must not become an AI-graphic factory that decorates every post.

## 13. `MediaRequirement` expansion

The existing `MediaRequirement` contract should expand beyond automatic product capture.

Suggested fields:

```text
mediaRequirementId
campaignId
contentPieceId
purpose
recommendedKind
requiredEvidence[]
assetRoleBindings[]
mustShow[]
mustAvoid[]
transformationConstraints[]
referenceAssetIds[]
finalCandidateAssetIds[]
sourceFootageIds[]
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

It describes **what is needed**, not how to execute it.

## 14. `MediaPlan`

`MediaPlan` describes how one requirement will actually be produced.

Suggested fields:

```text
mediaPlanId
mediaRequirementId
revision
productionMethod
sourceAssetVersionIds[]
steps[]
providerTasks[]
deterministicTransforms[]
captureRecipeId?
carouselCompositionPlanId?
videoEditPlanId?
imageCompositionPlanId?
renderTargets[]
estimatedCost
privacyPolicySnapshot
rightsPolicySnapshot
status
```

Example:

```text
output: instagram_reel
sources: clip1, clip3, logo
steps:
- transcribe source audio
- detect scenes
- select 22 seconds
- build edit timeline
- generate captions
- render vertical cut
- derive cover

deliverables:
- reel-9x16.mp4
- cover-4x5.png
```

## 15. Static-media production families

Static media should support several distinct operations.

### Reuse

Use an existing final candidate without modification or with allowed normalization only.

### Deterministic editing

Examples:

- crop/resize;
- background removal;
- framing;
- text/brand overlays;
- browser/device frames;
- color normalization where appropriate;
- simple cleanup through deterministic processors where possible;
- comparisons;
- collage/composition;
- diagram/layout rendering.

### Generative editing

Useful when transformation requires semantic reconstruction, object removal/addition, background extension or other model-based editing.

### Image generation

Useful when no suitable visual exists and generated imagery is authentic/appropriate for the story.

Generated visuals should not replace real evidence when the content is making a concrete product/factual claim that is better shown with real screenshots/data.

## 16. Image capability classes

The Inference Fabric should distinguish tasks rather than a generic `imageAI` capability.

Examples:

```text
IMAGE_UNDERSTANDING
IMAGE_GENERATION
IMAGE_EDITING
IMAGE_COMPOSITING
BACKGROUND_REMOVAL
IMAGE_UPSCALE
IMAGE_RESTORATION
OCR
LAYOUT_DIRECTION
VISUAL_QUALITY_CRITIQUE
```

One provider may support only a subset. Routing follows provider capability + privacy + rights + cost policy.

## 17. Deterministic composition versus generative composition

When users ask to combine images, SignalFlow should choose the correct method.

### Prefer deterministic composition when

- arranging screenshots/cards;
- building product-launch graphics;
- adding frames/shadows/labels;
- creating before/after layouts;
- preserving exact product UI;
- maintaining typography/brand consistency.

### Prefer generative editing when

- creating/reconstructing a scene around supplied material;
- extending a background semantically;
- removing/replacing complex objects;
- creating illustrative material not expected to be pixel-faithful evidence.

This distinction improves factual reliability and repeatability.

## 18. Carousel is a narrative object

A carousel is not merely `images[]`.

It is a sequential content piece with slide-level semantics.

Example:

```text
1. Hook
2. Problem
3. Why existing approaches fail
4. Core idea
5. How it works
6. Evidence/example
7. Takeaway/CTA
```

Suggested `CarouselCompositionPlan`:

```text
carouselCompositionPlanId
contentPieceId
revision
purpose
aspectRatio
slideCount
slides[]
visualSystemRef
sourceAssetVersionIds[]
brandProfileRef
renderTargets[]
status
```

## 19. Carousel slide contract

Suggested slide fields:

```text
slideId
order
semanticRole
headline
body
visualBinding
sourceEvidenceRefs[]
layoutPrimitive
accessibilityText
transitionHint?
status
```

Semantic roles can include:

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

## 20. Semantic carousel renderer

AI decides meaning/sequence/layout intent. Deterministic software renders consistent slides.

Initial semantic primitives may include:

- HookSlide;
- StatementSlide;
- ProblemSlide;
- ScreenshotSlide;
- DiagramSlide;
- FeatureSlide;
- ComparisonSlide;
- BeforeAfterSlide;
- MetricSlide;
- ListSlide;
- ProcessSlide;
- TimelineSlide;
- CodeSlide;
- QuoteSlide;
- ClosingSlide;
- CTASlide.

Avoid requiring image-generation models to render typography-heavy slide decks consistently.

## 21. Slide-level revision behavior

Carousel edits should be dependency-aware.

Examples:

- "Slide 4 is too technical" regenerates/revises slide 4 and dependent pagination only.
- "Move slide 5 before slide 3" changes sequence without rewriting all copy.
- "Use screenshot B on slide 5" changes the visual binding only.
- "Make all body text smaller" changes presentation/layout style, not content meaning.

The system stores structured carousel revisions rather than only the final PNG files.

## 22. User-uploaded footage pipeline

SignalFlow should support basic content-creator editing from raw uploaded clips without becoming a Premiere/Resolve replacement.

Target flow:

```text
raw clips
    ↓
asset ingestion + policy/rights checks
    ↓
transcription / audio analysis
    ↓
scene/shot segmentation
    ↓
visual understanding + quality signals
    ↓
usable moment selection
    ↓
VideoNarrative
    ↓
VideoEditPlan
    ↓
deterministic timeline render
    ↓
captions / overlays / audio treatment / cover
    ↓
quality/privacy review
    ↓
exact revision approval
```

## 23. Basic creator-editing scope

SignalFlow may automate common repetitive edits:

- trim;
- remove obvious dead space;
- reorder clips;
- join clips;
- crop/reframe;
- horizontal-to-vertical adaptation;
- subtitles/captions;
- title cards;
- simple overlays;
- logo/brand treatment;
- basic transitions;
- simple speed changes;
- zoom/focus emphasis;
- simple audio leveling/ducking;
- optional user-provided/licensed music;
- intro/outro;
- thumbnails/covers;
- platform variants.

This is the useful 80% automation layer.

## 24. Explicit video non-goals

Initially do not attempt to replace professional nonlinear editors with:

- complex masking/rotoscoping;
- unrestricted manual keyframe systems;
- advanced node-based VFX;
- professional color-grading suites;
- DAW-level audio editing;
- arbitrary compositing graphs;
- large effects/plugin ecosystems;
- unrestricted generative transformation of real people.

Advanced users can export or continue work elsewhere.

## 25. `VideoNarrative`

Meaning and presentation should be separate.

Suggested fields:

```text
videoNarrativeId
contentPieceId
purpose
hook
beats[]
requiredMoments[]
optionalMoments[]
closing
voiceoverIntent?
captionIntent
brandTone
```

Changing typography or a transition should not require rewriting the narrative.

## 26. `VideoEditPlan`

Suggested fields:

```text
videoEditPlanId
contentPieceId
mediaRequirementId
revision
purpose
durationTarget
aspectRatio
sourceClipBindings[]
timeline[]
captionTrack
audioPolicy
transitionPolicy
brandProfileRef
coverPlan?
renderVariants[]
status
```

Timeline entries can include:

```text
start
end
sourceAssetVersionId
sourceIn
sourceOut
crop/focus
speed
transitionIn
transitionOut
overlays[]
captionRef?
audioGain?
```

Natural-language instructions mutate this structured plan rather than becoming untraceable render prompts.

## 27. Natural-language video editing

Examples:

- "The first three seconds are boring." → replace/trim opening timeline segment.
- "Use clip 3 first." → reorder bindings.
- "Remove the clip where I look at the camera." → remove matching segment after confirmation if ambiguity exists.
- "Captions are too large." → update caption style only.
- "Transitions are too flashy." → update transition policy.
- "Use this photo as the cover." → bind cover asset.
- "Make it 25 seconds." → re-optimize timeline against duration constraint.

The product should show meaningful diff/revision state for material changes.

## 28. Product capture and uploaded footage converge later

There are two different acquisition paths:

```text
A. SignalFlow CaptureRecipe → screenshot/screencast Assets
B. User upload/share → footage/photo Assets
```

They converge on:

```text
canonical Assets
    ↓
MediaPlan / MediaComposition
    ↓
reviewable output revisions
```

This prevents duplicate rendering/versioning/approval systems.

## 29. Generated video

Generative video may later fill gaps where appropriate, but should not be the default method for editing real footage or demonstrating a real product.

Potential uses:

- illustrative B-roll when clearly appropriate;
- optional transitions/background material;
- abstract concept visuals;
- missing non-factual filler footage where rights/identity policy allows.

Real product demonstrations should prefer actual capture. Real creator footage should prefer editing the supplied footage.

## 30. Multi-destination media strategy

One narrative can intentionally receive different media treatment.

Example:

```text
LinkedIn → 7-slide carousel
X        → one architecture card + thread
Instagram→ 22-second Reel
Reddit   → text + diagram
YouTube  → defer; insufficient depth
```

This follows the existing rule that not every destination deserves the same variant.

## 31. Canonical asset reuse

SignalFlow should produce canonical master assets and derive platform variants rather than recreating the same work.

Example:

```text
demo-master
   ├─ 16:9
   ├─ 9:16
   ├─ 1:1
   ├─ cover frame
   └─ short excerpt
```

Reuse decisions must preserve:

- crop/focal safety;
- text readability;
- destination constraints;
- rights/use policy;
- exact revision lineage.

## 32. Meaning versus presentation

Store content meaning separately from rendering choices.

Examples:

```text
CarouselSlide content
        ≠
CarouselSlide layout
```

```text
VideoNarrative
        ≠
VideoEditPlan
```

```text
ImageCompositionIntent
        ≠
rendered PNG
```

This makes natural-language edits surgical instead of forcing full regeneration.

## 33. `ImageCompositionPlan`

Suggested fields:

```text
imageCompositionPlanId
contentPieceId
mediaRequirementId
revision
purpose
canvasTargets[]
layers[]
textElements[]
brandProfileRef
sourceAssetVersionIds[]
generativeEditTasks[]
deterministicTransforms[]
status
```

Layer types may include:

- source image;
- screenshot;
- generated background;
- mask;
- gradient/shape;
- title/body text;
- logo;
- annotation/callout;
- frame/shadow.

## 34. Reference images versus publishable images

The UI must make this distinction understandable.

For every supplied asset, the user should be able to choose or correct:

```text
Use in final content
Use as reference only
Use as evidence only
Edit this
Use in a combination
Do not use publicly
```

SignalFlow can infer a likely role from language but should surface that interpretation when it materially affects publication.

## 35. Ambiguity handling

Do not turn normal creative requests into long forms.

For mild ambiguity, make a best interpretation and expose it.

Example:

> "Use these photos for the post."

SignalFlow may interpret `FINAL_CANDIDATE`, then show:

```text
Using these in the final post
Change: Reference only / Edit first / Combine / Don't publish
```

For high-risk ambiguity involving private content, face/voice transformation, rights or destructive/public use, require explicit resolution before the risky operation.

## 36. Rights and provenance

Media origin and rights become increasingly important as creator features expand.

Track when relevant:

- user-created;
- company/client-owned;
- licensed stock;
- public-domain/compatible license;
- generated;
- unknown rights;
- source URL/provider;
- license/usage restrictions;
- music rights;
- model/generation provenance.

Uploaded does not automatically mean unrestricted publishing rights.

Unknown rights can block or warn for publication depending on policy.

## 37. Faces, voices and identity-sensitive transformations

Some operations require stronger explicit consent and capability policy.

Separate capabilities should exist for:

- face retouch that preserves identity;
- material face modification;
- face replacement;
- synthetic voice;
- voice cloning;
- lip sync;
- avatar generation.

Routine crop/caption/color/layout operations are not equivalent to identity transformation.

SignalFlow must not silently perform identity-sensitive transformations as part of generic "make it better" instructions.

## 38. Audio and music

Audio policy should distinguish:

- original clip audio;
- user-recorded narration;
- generated generic narration;
- approved user voice model;
- licensed/user-provided music;
- platform-library music that may require final in-app application;
- no audio.

Do not silently add unknown copyrighted music.

When direct API workflows cannot legally/technically apply platform-library audio, SignalFlow should provide truthful handoff rather than claim final publication readiness.

## 39. Accessibility

Media production should account for:

- captions/subtitles;
- readable text size/contrast;
- safe visual hierarchy;
- alt text for supported destinations;
- carousel reading order;
- avoiding information conveyed only by color;
- transcript availability where useful;
- reduced-motion considerations in previews.

## 40. Quality critics

Final media may be checked for:

- crop failures;
- unreadable text;
- clipped captions;
- inconsistent branding;
- duplicated slides;
- visual repetition;
- pacing/dead-space problems;
- low-resolution source use;
- factual mismatch with narrative;
- accidental private information;
- rights/consent policy;
- destination-safe dimensions/duration.

Critics may recommend changes but do not silently replace an approved revision.

## 41. Inference Fabric integration

Media production uses task-specific inference capabilities.

Potential task kinds:

```text
MEDIA_INTENT_RESOLUTION
MEDIA_FORMAT_RECOMMENDATION
IMAGE_UNDERSTANDING
IMAGE_EDITING
IMAGE_GENERATION
IMAGE_COMPOSITING
VISUAL_QUALITY_CRITIQUE
FOOTAGE_SCENE_UNDERSTANDING
FOOTAGE_MOMENT_SELECTION
VIDEO_NARRATIVE_PLANNING
CAPTION_GENERATION
AUDIO_TRANSCRIPTION
VOICEOVER_SCRIPTING
```

Provider selection is handled through `INFERENCE_AND_PRIVACY_ARCHITECTURE.md`.

The media domain does not directly import provider SDKs.

## 42. Privacy integration

Every media task carries the appropriate `ProcessingPolicy` and asset-level restrictions.

Examples:

```text
LOCAL_ONLY screenshot
→ remote vision route denied
```

```text
CONFIDENTIAL footage
→ permitted commercial processor only if policy allows
```

```text
REFERENCE_ONLY image
→ model may inspect if allowed, but renderer/publication cannot bind it as final media
```

Raw private assets must not appear in generic logs, analytics or release evidence.

## 43. Cost control

Media can be substantially more expensive than text.

Cost-aware planning should prefer:

1. reuse existing suitable asset;
2. deterministic transform;
3. deterministic composition;
4. bounded model-based editing;
5. generation when necessary;
6. expensive video generation only where justified.

Also control:

- vision calls per clip/frame;
- transcription reuse;
- proxy generation;
- render resolution during drafts;
- number of final aspect variants;
- intermediate retention;
- model retry count;
- duplicate generation.

## 44. Proxy and draft workflow

For large video files, use lower-cost proxies for understanding/edit planning where appropriate, while preserving the original as render source.

```text
original high-quality footage
   ↓
proxy / transcript / thumbnails
   ↓
AI planning + user review
   ↓
final render references original media
```

This improves performance without degrading final output.

## 45. Exact media revision approval

Approval binds exact media revisions, not a conceptual project.

A publication request may include:

```text
textRevisionId
mediaCompositionRevisionIds[]
carouselRevisionId?
videoEditRevisionId?
coverAssetVersionId?
```

If a material edit produces a new media revision after approval, approval is invalidated or requires explicit policy-driven re-approval.

## 46. Review UX

Review should answer:

- What exactly will be published?
- Which assets are references only?
- Which assets were edited/generated?
- What changed since the approved/previous revision?
- Which destination receives which media?
- Is any item blocked by privacy/rights/quality?

Users should be able to request natural-language changes without losing structured state.

## 47. Direct Create UX principle

Do not start with 47 content-type dropdowns.

A strong entry can be:

```text
What do you want to make or talk about?

[ natural-language input ]

+ Photos
+ Videos
+ Files
+ Links
+ Capture
```

Examples:

- Make a Reel from these clips.
- Turn this document into a carousel.
- Post about this lesson; these images are references only.
- Combine these screenshots into one launch visual.
- Edit this photo and create an Instagram post.

SignalFlow interprets the request into canonical records and lets the user correct important assumptions.

## 48. Platform derivative behavior

A platform derivative is not automatically a completely new creative work.

Prefer:

```text
canonical story/media master
        ↓
platform-aware transform
```

rather than independent generation per platform when reuse is valid.

However, platform-native differences can justify distinct media compositions when the narrative/format genuinely differs.

## 49. Creator use case and product boundary

Basic creator production is a natural secondary use case:

> "I already have the footage/assets. Handle the repetitive edit and distribution work."

This remains aligned with SignalFlow because the product still removes operational content burden.

The goal is not to compete feature-for-feature with professional editing suites. The goal is to automate the common path from raw material to reviewable platform-ready content.

## 50. Integration with automatic product capture

`CAPTURE_AND_MEDIA_PRODUCTION.md` remains canonical for safe automatic web/product capture.

This document adds the broader intelligence/creative layer.

Relationship:

```text
Media Intelligence
   ↓
MediaRequirement
   ↓
choose acquisition/production method
   ├─ existing/uploaded asset
   ├─ image edit/generation/composition
   ├─ carousel renderer
   ├─ uploaded-footage editor
   ├─ browser CaptureRecipe
   └─ later DesktopCaptureRecipe
   ↓
MediaComposition revision
```

## 51. Product invariants

- Upload does not equal permission to publish.
- Original source media is immutable.
- Reference-only/evidence-only assets cannot silently become final media.
- Explicit user instructions outrank media optimization.
- Not every story needs media.
- Not every destination needs the same media.
- Real evidence is preferred over synthetic decoration when making factual/product claims.
- AI directs semantic choices; deterministic systems perform repeatable transforms/renders where possible.
- Natural-language edits mutate structured plans.
- Exact media revisions are approval-bound.
- Private/rights/identity-sensitive operations fail closed when policy is unmet.
- Creator features do not require building a professional general-purpose editor.

## 52. Personal Alpha sequencing implication

Do not block Golden Path 1 on full creative media.

Recommended dependency order:

1. text/editorial Golden Path works;
2. canonical asset roles/use policy exist where media is attached;
3. Media Decision can return `NONE`, existing image or screenshot;
4. automatic screenshot Golden Path;
5. deterministic carousel proof;
6. basic image composition/edit proof;
7. uploaded-footage Reel proof;
8. richer generative image/video capabilities only after the deterministic/revision/privacy system is trustworthy.

## 53. Definition of done for a creative-media slice

A feature is not done because one attractive image/video was generated.

Close only when the slice has:

- canonical intent/role/use-policy state;
- immutable original + derived revision lineage;
- structured plan state;
- provider-neutral inference where AI is required;
- deterministic processing where appropriate;
- privacy/rights/identity checks;
- retry/cancel/recovery where jobs are long-running;
- platform-ready derivative verification;
- natural-language revision behavior;
- exact revision approval;
- truthful capability reporting;
- end-to-end user proof with real input and reviewable output.
