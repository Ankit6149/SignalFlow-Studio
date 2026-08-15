# SignalFlow Studio — Capture and Media Production Architecture

> **Status:** canonical target design for automatic evidence capture and deterministic product-demo production. Current product truth remains governed by the capability matrix; planned capture/recording/rendering features must not be presented as already available.
>
> **Broader media architecture:** this document now sits underneath `MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` and `CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`. Those documents own media intent, asset roles/use permissions, image editing/generation/compositing, carousels, uploaded-footage editing, direct creative requests and rights/consent. This document remains authoritative for safe automatic browser/product capture and repeatable render production.

## 1. Product goal

SignalFlow should remove the routine burden of manually creating simple product-showcase media.

For common campaigns the user should not need to:

- open the app and recreate a flow for recording;
- search for a clean screen state;
- manually capture multiple screenshots;
- crop each screenshot for different platforms;
- record a screen while trying to move the mouse smoothly;
- repeatedly trim dead time from recordings;
- add logo intros/outros by hand;
- add subtitles, callouts, framing, zooms, or transitions manually;
- export separate 16:9, 9:16, 1:1, and 4:5 versions from scratch.

SignalFlow should determine what evidence/media a narrative requires, generate it through safe deterministic workflows where possible, and present final assets for approval together with the text they support.

This automatic-capture pipeline is one production method selected by the broader Media Intelligence system. If the user already supplied suitable media, requested an image edit, asked for a carousel, or uploaded raw footage, the system should choose those production paths instead of forcing a CaptureRecipe.

## 2. Production principle

> **Use AI to direct media. Use deterministic software to capture, compose, and render it whenever deterministic production is possible.**

This means:

### AI is useful for

- deciding whether a story needs no media, an existing asset, screenshot, comparison, demo, diagram, carousel, edited/generated image, or video;
- selecting what part of a product matters;
- proposing safe capture steps;
- choosing important moments from a recording;
- writing on-screen copy and subtitles;
- proposing framing, sequence, pacing, callouts, and crop priorities;
- checking visual evidence against the campaign narrative;
- generating optional decorative/illustrative material when appropriate.

### Deterministic systems are preferred for

- browser navigation through declared recipes;
- screenshots;
- screencasts;
- crop/resize;
- logo/brand rendering;
- typography;
- subtitles;
- transitions;
- motion composition;
- deterministic screenshot/image layout;
- audio mixing where licensed/user-provided;
- encoding;
- social aspect-ratio variants.

This produces consistent brand quality and avoids relying on stochastic video generation for simple product demonstrations.

## 3. Position inside the broader media lifecycle

```text
NarrativeStrategy / Direct Create request
      ↓
MediaIntentResolution + AssetRole/AssetUsePolicy
      ↓
MediaDecision
      ↓
MediaRequirement
      ↓
MediaPlan chooses production method
      ↓
      ├─ existing/uploaded asset
      ├─ image edit/generation/composition
      ├─ carousel renderer
      ├─ uploaded-footage editor
      ├─ automatic browser CaptureRecipe  ← this document
      └─ later DesktopCaptureRecipe
      ↓
MediaComposition revision
      ↓
Quality / privacy / rights checks
      ↓
User review + exact approval
```

The rest of this document focuses on the automatic capture branch.

## 4. `MediaRequirement`

The broader contract is defined in `CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`. For automatic capture, the requirement must indicate that capture is appropriate/allowed and describe what visual evidence is needed.

Capture-relevant fields include:

```text
mediaRequirementId
campaignId
contentPieceId
purpose
recommendedKind
requiredEvidence[]
mustShow[]
mustAvoid[]
preferredAspectRatios[]
durationTarget?
textOverlayNeeds[]
captureAllowed
priority
status
```

Example:

```text
recommendedKind: PRODUCT_DEMO_VIDEO
purpose: demonstrate that a user can choose a content angle and approve without configuring every platform
mustShow:
- Today opportunity card
- angle selection
- review/approval state
mustAvoid:
- real private account data
- API keys
- personal notifications
preferredAspectRatios:
- 16:9
- 9:16
```

## 5. `CaptureRecipe`

A CaptureRecipe defines a reproducible, permissioned product walkthrough.

Example:

```text
Recipe: campaign-angle-demo
Target: https://preview.example.com
Environment: safe-demo

1. open /today
2. wait for opportunity fixture
3. click opportunity "Capture pipeline"
4. choose angle "Why this exists"
5. open generated review fixture
6. focus approval area
```

Suggested record:

```text
captureRecipeId
workspaceId
projectId
title
version
targetOrigin
allowedEnvironment
steps[]
preconditions[]
requiredCapabilities[]
secretRequirements[]      # secret references, never values
fixturePolicy
privacyRules[]
expectedCheckpoints[]
status
createdAt
updatedAt
```

## 6. Why recipes are safer than random AI clicking

A general browser agent that improvises through a production application creates unnecessary risk:

- accidental destructive actions;
- private data capture;
- unstable videos;
- unpredictable authentication state;
- different flows every render;
- hard-to-reproduce failures;
- higher token/model cost;
- poor testing.

A CaptureRecipe provides a bounded action space. AI may propose or revise recipes, but execution should validate every step against allowed origins/actions.

## 7. Capture environments

Prefer capture against a controlled environment rather than a user's live production workspace.

Supported future modes may include:

### Safe demo fixture

Best for repeatable marketing/product demos.

- deterministic data;
- no personal information;
- no secrets;
- stable element identities;
- predictable success states.

### Preview deployment

Useful when showing a newly developed feature.

- exact branch/preview version;
- temporary scoped credentials if required;
- test data only;
- capture recipe version tied to deployment.

### Trusted authenticated owner capture

Only when necessary.

- explicit user opt-in;
- strongly scoped target/origin;
- visible capture state;
- sensitive-field/redaction checks;
- short-lived session/secret references;
- no generic background browsing.

## 8. Browser capture worker

Browser capture must run as a durable worker/job rather than inside the normal frontend request lifecycle.

Responsibilities:

```text
validate CaptureRecipe
    ↓
resolve allowed target/deployment
    ↓
launch isolated browser context
    ↓
perform bounded steps
    ↓
record checkpoints + safe logs
    ↓
capture screenshot/screencast/frame outputs
    ↓
create canonical Asset records
    ↓
store bytes in object storage
    ↓
return capture result
```

The worker must support timeout, cancellation, retry classification, and deterministic failure reasons.

## 9. Capture job truth states

Recommended states:

```text
queued
preparing_environment
launching_browser
navigating
waiting_for_checkpoint
capturing
processing_output
succeeded
partially_succeeded
failed
cancelled
expired
```

Failure examples:

- target unavailable;
- recipe step missing;
- unauthorized origin;
- login/session unavailable;
- privacy rule triggered;
- layout changed;
- timeout;
- browser crash;
- output write failed.

Do not report a capture as successful merely because a browser navigation command executed.

## 10. Screenshot capture

Screenshot production should support semantic intent, not only `fullPage=true`.

Useful capture types:

- viewport screenshot;
- full-page screenshot when actually useful;
- element/region screenshot;
- before/after comparison pair;
- focused product-state screenshot;
- multi-step sequence for carousel;
- high-density source image for later crops/compositions.

Each screenshot asset should record:

```text
captureRecipeId
captureJobId
step/checkpoint
viewport
deviceScaleFactor
origin
capturedAt
sourceDeploymentRef?
contentHash
privacyReviewState
```

Captured outputs enter the same immutable Asset/version lineage used by uploaded and generated media. A captured screenshot is not automatically approved for public use merely because capture succeeded.

## 11. Screen recording / screencast

A screencast should record a planned interaction, not an uncontrolled session.

A recording plan can define:

- start checkpoint;
- stop checkpoint;
- cursor visibility;
- pauses;
- step annotations;
- optional spotlight/focus metadata;
- target duration;
- crop-safe focus region;
- whether audio is included;
- whether later synthetic/user voice-over is planned.

Raw capture remains a source asset. Trims and compositions are derived assets/revisions.

A raw CaptureRecipe screencast may later feed the same `VideoNarrative` / `VideoEditPlan` pipeline as uploaded creator footage when further editing is appropriate.

## 12. `MediaCompositionPlan`

Represents how source assets become a polished deliverable. The broader creative-media domain may use specialized `ImageCompositionPlan`, `CarouselCompositionPlan` or `VideoEditPlan`; this record remains useful for semantic product-demo/motion composition.

Suggested fields:

```text
mediaCompositionPlanId
campaignId
contentPieceId
revision
outputKind
baseAspectRatio
scenes[]
transitionPolicy
typographyProfileId
brandAssetIds[]
audioAssetIds[]
captionTrack?
voiceoverTrack?
renderVariants[]
createdByGenerationRunId?
```

Example scene sequence:

```text
00:00–00:01.4   BrandIntro
00:01.4–00:03.2 Statement: "Content shouldn't become a second job."
00:03.2–00:08.8 BrowserDemo: angle selection → review
00:08.8–00:11.5 PlatformPreviewStack
00:11.5–00:14.0 Statement: "Build. Approve. Keep building."
00:14.0–00:15.0 BrandOutro
```

## 13. Motion system

The renderer should be built around reusable semantic components rather than arbitrary timeline coordinates everywhere.

Potential scene library:

```text
BrandIntro
BrandOutro
ProductReveal
FeatureTitle
BrowserFrame
BrowserDemo
ScreenshotFloat
SplitComparison
BeforeAfter
ZoomFocus
CodeSnippet
Metric
FeatureChecklist
Quote
CaptionCard
PlatformPreviewStack
LogoTransition
CTA
```

Potential transitions:

```text
cut
fade
slide
mask reveal
scale/push
blur transition
shape reveal
camera push
```

Each scene must support responsive composition rules for target aspect ratios.

## 14. Multi-aspect-ratio rendering

The same semantic composition should render multiple destination variants without manual re-editing.

Common target families:

| Format | Typical use |
| --- | --- |
| 16:9 | YouTube, landscape web/LinkedIn demos |
| 9:16 | Reels, Shorts, TikTok |
| 1:1 | square social cards/clips |
| 4:5 | portrait feed placement |

Important content should declare safe regions and focal subjects so layout rules can reposition rather than blindly crop.

## 15. `MediaComposition`

A rendered composition is versioned.

Suggested fields:

```text
mediaCompositionId
mediaCompositionPlanId
revision
renderJobId
status
sourceAssetVersionIds[]
outputAssetIds[]
duration
aspectRatio
resolution
codec/container
qualityReview
privacyReview
rightsReview?
approvedAt?
approvedBy?
```

A draft edit should not silently change an already approved media composition, and media revision changes may invalidate publication approval depending on policy.

## 16. Carousels and static visual cards

Carousels are now fully specified in `MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` and `CREATIVE_MEDIA_DOMAIN_CONTRACTS.md` as narrative objects with stable slide IDs, semantic roles and slide-level revision behavior.

Automatic product screenshots from this capture pipeline may be used as carousel visual bindings.

The AI decides slide meaning and sequencing; deterministic layout/rendering should enforce typography, spacing, brand consistency and platform output dimensions.

## 17. Thumbnails

Thumbnail production should be tied to the content promise.

A thumbnail plan may include:

- subject/screenshot;
- concise text;
- contrast/focal hierarchy;
- crop-safe region;
- platform variant;
- brand treatment.

Generated image models may be used when appropriate, but product screenshots and deterministic layouts should be preferred when truthfully demonstrating the product.

Thumbnail source/use rights follow `AssetUsePolicy`.

## 18. Voice-over and audio

Voice-over support must be optional and explicit.

Possible modes:

- no voice-over;
- text-only captions;
- user-recorded narration;
- user-approved synthetic voice where legally/ethically permitted;
- generic synthetic narration that is not impersonation.

Audio assets need provenance/licensing metadata. The product must not silently add copyrighted music from unknown sources.

Identity-sensitive voice cloning/face/lip-sync features are not generic editing capabilities and require stronger explicit policy as defined in the broader creative-media architecture.

## 19. Privacy, rights and redaction

Capture/media is a high-risk surface.

Before upload/render/publication, systems should support checks for:

- API keys/tokens;
- email addresses/phone numbers where not intended;
- private repository paths;
- private customer/user data;
- notification popups;
- browser bookmarks/history/profile data;
- internal URLs;
- credentials/forms;
- unintended tabs/windows;
- faces/names where user policy requires redaction;
- asset-use restrictions;
- unknown/restricted media rights.

A privacy/rights review may be automated plus manual where risk is high. A detected blocker prevents publication until resolved.

## 20. Capture from browser extension versus capture worker

These solve different needs.

### Browser extension

Best for user-initiated capture of real browsing context:

- selected text;
- page context;
- screenshot;
- recording;
- user note;
- current source material.

### Hosted/local capture worker

Best for reproducible product demonstrations:

- known URL;
- controlled recipe;
- repeatable screenshots;
- repeatable screencasts;
- campaign production automation.

Both create canonical Assets/SourceArtifacts but preserve different provenance and then enter the same media-intent/use-policy system.

## 21. CaptureRecipe and test automation relationship

Recipes may share concepts with E2E test flows but they are not automatically the same thing.

A marketing/demo recipe may intentionally:

- pause for visual clarity;
- frame one feature;
- use polished fixture data;
- hide irrelevant controls;
- capture only a subset of the full acceptance path.

Where safe, reusable selectors/fixtures can reduce duplication between product testing and capture infrastructure.

## 22. Reproduction and versioning

A produced asset should be reproducible enough to answer:

- which application deployment/version was captured?
- which recipe version ran?
- which fixture/data state was used?
- which source assets entered the composition?
- which composition-plan revision rendered it?
- which renderer version was used?
- which asset-use/privacy/rights policy applied?

This protects historical campaign provenance when the product UI changes later.

## 23. Production cost control

Media production can become expensive.

The planner should estimate or constrain:

- capture attempts;
- recording duration;
- render resolution;
- number of aspect-ratio variants;
- OCR/transcription/vision calls;
- optional generative media calls;
- storage size;
- retained intermediates.

The broader media planner should prefer in order where quality permits:

1. reuse an existing suitable asset;
2. deterministic transform;
3. deterministic composition;
4. bounded generative edit;
5. new generation;
6. expensive generative video only when justified.

## 24. Personal Alpha media scope

The first useful owner flow should intentionally stay small.

### Required early

- explicit attached-media role/use policy where media is present;
- Media Decision can return `NONE`, existing image or required screenshot;
- safe browser screenshots;
- one deterministic product-demo screencast path;
- crop/resize variants;
- simple branded video composition;
- captions/callouts;
- 16:9 + 9:16 output;
- review/approval of exact final media.

### Follow-on creative proofs

- deterministic carousel from structured slide plan;
- basic deterministic image composition;
- one bounded provider-backed image edit path;
- uploaded-footage short/Reel editing from structured VideoEditPlan.

### Later

- sophisticated timeline editing;
- automatic B-roll generation;
- advanced audio/music tooling;
- complex 3D motion;
- unrestricted agent navigation;
- large template marketplaces;
- professional-editor replacement features.

## 25. Definition of done for a media production slice

A capture/media feature is not done because a file was rendered once.

It requires:

- canonical intent/role/use-policy when relevant;
- canonical records and provenance;
- immutable original/derived lineage;
- durable job state;
- safe target authorization;
- deterministic fixtures/recipe tests;
- retry/cancellation behavior;
- object-storage integration where hosted;
- privacy/redaction/rights handling;
- responsive/aspect-ratio output checks;
- exact media revision bound to approval/publication;
- truthful capability reporting;
- no secret/private data in logs or evidence.

Read `MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` before implementing any new non-capture image/carousel/creator-video feature.
