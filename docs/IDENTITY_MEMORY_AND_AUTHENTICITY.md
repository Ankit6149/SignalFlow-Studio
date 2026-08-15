# SignalFlow Studio — Identity, Memory, and Authenticity

> **Status:** canonical target design for how SignalFlow should represent a person/project and learn from user judgment. This replaces the idea that authenticity can be solved by a small `tone` dropdown.

## 1. Why this system is necessary

Platform formatting is relatively easy for an LLM. Authentic representation is much harder.

A draft can be technically correct for LinkedIn, X, Reddit, or another destination while still being wrong because it:

- sounds like generic AI marketing;
- projects a personality the user does not want;
- overstates confidence;
- makes every update sound like a launch;
- uses vocabulary the user would never use;
- repeats the same storytelling pattern;
- shares too much personal information;
- becomes too corporate, too performative, too technical, or too simplified;
- optimizes for engagement at the expense of identity;
- forgets what the user has already told their audience.

SignalFlow therefore needs persistent identity and narrative memory that survives individual campaigns.

## 2. Identity is not one field

The target model separates at least five concepts:

```text
Identity
Desired Perception
Voice / Communication Style
Boundaries
Platform Expression
```

These concepts influence each other but must remain independently editable/versioned.

## 3. `IdentityProfile`

Answers:

> **Who is the user in the context of public communication?**

Possible structured dimensions:

```text
identityProfileId
workspaceId
userId
schemaVersion
version
worldviewNotes[]
areasOfExpertise[]
areasOfCuriosity[]
recurringBeliefs[]
personalityTraitsToExpress[]
backgroundContext[]
credibilitySources[]
preferredVulnerabilityLevel
preferredTechnicalDepth
preferredHumourStyle
preferredConfidenceStyle
personalThemes[]
professionalThemes[]
updatedAt
```

This should not become a rigid personality test. Free-form examples and user-written notes remain important.

## 4. `PerceptionProfile`

Answers:

> **How does the user want an audience to understand them over time?**

Examples:

- thoughtful builder rather than loud marketer;
- technically credible but understandable;
- curious rather than pretending to know everything;
- product-focused without reducing identity to one product;
- useful and calm rather than motivational/influencer-like;
- honest about limitations;
- ambitious without empty hype.

Suggested fields:

```text
perceptionProfileId
identityProfileId
qualitiesToSignal[]
qualitiesToAvoid[]
desiredAudienceImpressions[]
longTermNarrative[]
currentPositioning[]
credibilitySignals[]
antiPatterns[]
version
```

SignalFlow should be able to explain which perception goals influenced a recommendation.

## 5. `VoiceProfile`

Answers:

> **How does the user naturally communicate?**

It may contain:

```text
sentenceLengthPreference
paragraphRhythm
openingPatternsPreferred[]
openingPatternsAvoided[]
vocabularyPreferred[]
vocabularyAvoided[]
phrasesNeverUse[]
emojiPolicy
hashtagPolicy
punctuationPreference
ctaStyle
storytellingPatterns[]
analogyStyle
technicalExplanationStyle
humourPatterns[]
formalityRange
firstPersonPreference
questionUsage
formattingPreferences
approvedExamples[]
rejectedExamples[]
```

Do not convert these dimensions into hard rules unless the user explicitly marks them as rules. Many should be weighted preferences.

## 6. Platform voice is an overlay, not a different personality

The same person should remain recognizable while adapting to different platform cultures.

```text
Final expression =
Identity
+ Desired Perception
+ Voice Preferences
+ Platform Voice Overlay
+ Campaign Narrative
+ Source Evidence
+ Recent Narrative Memory
```

Examples:

### LinkedIn overlay

- more context and narrative;
- professional credibility;
- may explain why a decision mattered;
- avoid generic corporate announcement language.

### X overlay

- tighter thought;
- faster opening;
- individual lines/posts must stand on their own where possible;
- less context duplication.

### Reddit overlay

- usefulness and evidence first;
- disclose limitations;
- avoid polished promotional framing;
- participate as a community member, not an ad.

### YouTube overlay

- strong title/hook but accurate promise;
- visual explanation and progression;
- deeper context where valuable.

Platform overlays must never authorize claims or identity behavior prohibited by global boundaries.

## 7. `BoundaryProfile`

Explicit user boundaries outrank engagement optimization.

Possible boundaries:

```text
privateTopics[]
neverMentionPeople[]
neverMentionProjects[]
confidentialUntilDate[]
noUnverifiedMetrics
noRevenueClaimsWithoutEvidence
noPersonalFamilyDetails
noPoliticalCommentary
noFounderLanguage
noExaggeratedLaunchLanguage
noManufacturedVulnerability
noEngagementBait
```

A boundary may be:

- global;
- project-specific;
- destination-specific;
- time-limited;
- campaign-specific.

If a proposed story violates a boundary, the system should block or require explicit override rather than quietly weakening the rule.

## 8. Learning through normal review

The user should not need to configure every nuance manually.

The review flow generates useful feedback events.

### Positive signals

- approve unchanged;
- approve with minimal edit;
- repeatedly choose the same type of opening;
- repeatedly select a narrative angle family;
- repeatedly remove unnecessary hashtags and then approve.

### Negative signals

- regenerate;
- reject;
- remove an entire platform;
- mark too corporate;
- mark too generic;
- mark too personal;
- mark too technical;
- mark too promotional;
- say “I would never say this.”

### Explicit signals

- “I like this style.”
- “Do this more often.”
- “Never use this phrase again.”
- “For Reddit, be much more factual.”
- “Don't make every update about my app.”

These should become `FeedbackEvent` records before they become long-term memory.

## 9. Revision-delta analysis

When a user approves after editing, SignalFlow can compare generated and approved revisions.

Example:

Generated:

```text
Thrilled to announce the launch of our new capture workflow...
```

Approved:

```text
I kept losing time turning product work into something worth showing, so I changed how capture works...
```

Potential structured observations:

```text
removed:
- announcement framing
- generic excitement
- launch wording

added:
- problem-first opening
- first-person reasoning
- concrete personal friction

candidate preference:
"Prefer reason/problem openings over announcement openings."
```

The observation must not automatically become a permanent rule after one example.

## 10. `StyleMemoryHypothesis`

Use evidence accumulation.

Suggested structure:

```text
styleMemoryId
workspaceId
userId
hypothesis
category
confidence
evidenceCount
supportingFeedbackEventIds[]
contradictingFeedbackEventIds[]
exampleApprovedRevisionIds[]
exampleRejectedRevisionIds[]
status                  # candidate, active, user_confirmed, rejected, superseded
lastEvaluatedAt
```

Example:

```text
hypothesis:
"Prefer problem/reason openings over announcement openings"

evidenceCount: 7
confidence: 0.91
status: active
```

The user should be able to inspect and correct learned preferences.

## 11. Learned memory must remain explainable

Avoid a black-box hidden “AI personality score.”

The Voice/Memory UI should be able to show:

- explicit user rules;
- learned preferences;
- confidence;
- examples that produced the learning;
- whether the preference applies globally or to one platform;
- an action to confirm, edit, weaken, or remove it.

This makes the system trustworthy and prevents compounding wrong assumptions.

## 12. Narrative memory is different from style memory

### Style memory

Answers:

> How does the user prefer to communicate?

### Narrative memory

Answers:

> What has the audience already been told?

Do not merge these into one vector search bucket with no semantics.

## 13. `NarrativeMemory`

For each publication/campaign, retain structured public-story facts such as:

```text
narrativeMemoryId
workspaceId
projectId?
campaignId
publicationId?
contentPieceId
platform
topic
angle
claimsMade[]
featuresMentioned[]
limitationsDisclosed[]
evidenceShown[]
ctaIntent
publishedAt
audienceSegment?
followUpPossibilities[]
semanticFingerprint
```

This enables questions such as:

- Have we already announced this feature?
- Did we already explain why it exists?
- Which technical detail has never been discussed?
- What did the previous launch promise?
- Which screenshots were already used?
- Is this post repeating the same hook as three recent posts?
- What follow-up naturally comes next?

## 14. Repetition is broader than text similarity

SignalFlow should eventually detect repetition at multiple layers:

- exact/near-exact wording;
- hook structure;
- CTA structure;
- topic;
- claim;
- story angle;
- media reuse;
- emotional framing;
- campaign timing.

Example:

Two posts may have different wording but both effectively say:

> “I built Feature X because existing tools were too complicated.”

Narrative memory should recognize the repetition even if lexical duplicate detection does not.

## 15. Authenticity critic

Before presenting a draft as ready, a separate quality pass should compare it against:

```text
source evidence
identity profile
perception profile
voice profile
boundary profile
platform overlay
recent approved examples
recent rejected patterns
narrative memory
```

The critic should return structured issues rather than rewrite everything automatically.

Example issue codes:

```text
generic_marketing_language
identity_mismatch
too_corporate
unsupported_claim
repeated_story_angle
repeated_opening_pattern
excessive_personal_disclosure
platform_culture_mismatch
cta_mismatch
overstated_certainty
```

The generation/orchestration layer may perform one bounded revision for clear issues, but repeated automatic rewriting must not create an invisible loop.

## 16. Authenticity does not mean identical voice everywhere

A common failure would be to overfit “voice” so every platform receives the same sentence rhythm.

The product goal is:

> **same person, context-appropriate expression**

not:

> identical formatting and tone everywhere.

## 17. User onboarding for identity

Initial onboarding should be lightweight.

A useful first setup may ask only:

1. What are you primarily working/talking about?
2. How do you want people to understand you?
3. What do you dislike in AI-written content?
4. Are there topics/claims/styles SignalFlow should never use?
5. Optionally provide a few examples of writing you like from yourself.

The system then improves through real review history.

Avoid a long brand-consulting questionnaire before first value.

## 18. Project identity versus person identity

A user may have multiple projects with different product positioning while remaining the same person.

Recommended composition:

```text
Person Identity Profile
        +
Project / Brand Guidance
        +
Campaign Narrative
        +
Platform Overlay
```

Project guidance may define:

- product terminology;
- factual product description;
- audience;
- visual system;
- safe claims;
- prohibited claims;
- recurring product themes;
- logo/brand assets;
- launch stage.

It must not overwrite the person's communication identity unless explicitly configured as a separate brand/team voice.

## 19. Performance feedback is advisory

If platform analytics are later available, SignalFlow may learn patterns such as:

- audiences respond well to technical breakdowns;
- demos retain more viewers than static launch images;
- long intros reduce watch time;
- certain topics create useful discussion.

But performance data may not silently mutate:

- privacy boundaries;
- factual standards;
- approved identity;
- ethical/safety constraints.

A recommended learning should be explainable:

> “Your last three short demos received more completion than static clips. Consider a demo for this opportunity.”

Not:

> “The algorithm wants more vulnerability, so SignalFlow made the post personal.”

## 20. Memory retrieval strategy

Initial implementation does not require fine-tuning a model.

A practical approach:

1. store structured identity/profile records relationally;
2. store approved/rejected examples with stable references;
3. compute embeddings for semantic retrieval only where useful;
4. retrieve a small, relevant set of memories per task;
5. include explicit rules separately from retrieved examples;
6. record which memory snapshot influenced a generation.

This is cheaper, auditable, and reversible.

## 21. Fine-tuning policy

Do not make fine-tuning a prerequisite.

Consider fine-tuning only after:

- structured memory has enough real user data;
- prompt/retrieval approaches have demonstrated a persistent quality ceiling;
- privacy/data-retention implications are understood;
- model/provider economics justify it;
- training data can be versioned and deleted according to policy.

## 22. Data retention and deletion

Identity/memory data is highly personal.

Users must eventually be able to:

- export it;
- inspect it;
- remove one learned preference;
- delete approved/rejected examples from learning eligibility;
- reset style learning without deleting campaign history if desired;
- delete narrative memory according to account/data policy;
- understand which cloud/model providers receive profile context.

Do not hide identity learning inside opaque logs or provider histories.

## 23. Conflict resolution

Preferences may conflict.

Example:

```text
Global preference: concise writing
LinkedIn preference: explain reasoning in depth
Campaign requirement: complex architecture change
```

Resolution order should consider:

1. safety/boundaries;
2. explicit campaign instruction;
3. explicit platform preference;
4. explicit global preference;
5. high-confidence learned preference;
6. lower-confidence inference;
7. generic platform defaults.

Where conflict is material, the system may surface a review note rather than silently guessing.

## 24. Definition of successful authenticity

SignalFlow is not successful because a classifier says a draft matches a style vector.

It is successful when, over time:

- the user approves more content with fewer edits;
- repetitive corrections decrease;
- rejected generic patterns disappear;
- platform variants still feel native;
- the system remembers public narrative continuity;
- user boundaries are respected without repeated reminders;
- the user spends less attention producing content while retaining control of how they are represented.
