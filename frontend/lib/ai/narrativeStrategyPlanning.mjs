import { normalizeStrategyProposal } from "../domain/contentPlanning.mjs";

function safeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanString(value, maxLength = 12000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function safeIdentitySnapshot(input = {}) {
  const source = safeRecord(input);
  return {
    identityContextSnapshotId: cleanString(source.identityContextSnapshotId, 240),
    workspaceId: cleanString(source.workspaceId, 240),
    userId: cleanString(source.userId, 240),
    platform: source.platform || null,
    projectId: source.projectId || null,
    profileRefs: safeRecord(source.profileRefs),
    identity: safeRecord(source.identity),
    perception: safeRecord(source.perception),
    voice: safeRecord(source.voice),
    boundaries: safeRecord(source.boundaries),
    projectGuidance: safeRecord(source.projectGuidance),
    campaignInstructions: Array.isArray(source.campaignInstructions) ? source.campaignInstructions.slice(0, 40) : [],
    effectiveRules: Array.isArray(source.effectiveRules) ? source.effectiveRules.slice(0, 100) : [],
  };
}

export function normalizeStrategyTaskInput(input = {}) {
  const opportunity = safeRecord(input.opportunity);
  const identityContext = safeIdentitySnapshot(input.identityContext);
  const dataClassification = cleanString(input.dataClassification, 80).toLowerCase();
  if (!cleanString(opportunity.opportunityId, 240)) throw new TypeError("Narrative strategy requires a persisted opportunity.");
  if (!safeRecord(opportunity.selectedAngle).summary) throw new TypeError("Narrative strategy requires the selected opportunity angle.");
  if (!identityContext.identityContextSnapshotId || !identityContext.workspaceId) throw new TypeError("Narrative strategy requires an Identity Context Snapshot with workspace ownership.");
  if (!dataClassification) throw new TypeError("Narrative strategy requires the source data classification.");
  return { opportunity, identityContext, dataClassification };
}

export function buildNarrativeStrategyPrompt(input = {}) {
  const { opportunity, identityContext } = normalizeStrategyTaskInput(input);
  return `You are SignalFlow's editorial strategist. Build a CAMPAIGN PLAN from a user-approved narrative direction. Do not write the final LinkedIn or X post yet.

The output becomes a durable NarrativeStrategy that the user reviews before content generation.

NON-NEGOTIABLE RULES:
- Use only facts present in the opportunity and identity/project context. Never invent metrics, customers, dates, claims, life experiences, results, motivations, or publication history.
- The selected angle is a user decision. Preserve its intent unless an explicit higher-precedence safety/boundary rule conflicts.
- Identity means who the person is; desired perception means how they want to be understood; Voice means expression. Do not collapse them into a generic marketing persona.
- Explicit boundaries outrank campaign/platform/voice preferences.
- Repetition risk is not known unless the opportunity explicitly says otherwise. Do not pretend NarrativeMemory exists.
- Recommend media only when it genuinely improves explanation/evidence. text_only/none are valid.
- Destination absence is valid. LinkedIn and X are the only destinations considered in this Personal Alpha proof.
- Do not produce filler because a platform exists.
- A destination decision must be include, optional, or exclude with a reason.
- The narrative arc should describe beats/logic, not draft copy.
- Evidence plan should say what evidence is needed/available; do not fabricate evidence.

OPPORTUNITY + APPROVED ANGLE:
${JSON.stringify(opportunity, null, 2)}

EXACT IDENTITY CONTEXT SNAPSHOT:
${JSON.stringify(identityContext, null, 2)}

Return ONLY valid JSON:
{
  "title": "short internal plan title",
  "coreIdea": "single durable idea the content should communicate",
  "audienceTakeaway": "what the right reader should understand or remember",
  "narrativeArc": ["beat 1", "beat 2", "beat 3"],
  "hookDirection": "what kind of opening earns attention without writing final copy",
  "evidencePlan": ["evidence/check needed"],
  "factualConstraints": ["facts/claims that must remain bounded"],
  "boundaryConstraints": ["explicit identity/project boundaries relevant to this story"],
  "destinationPlan": [
    {"destination":"linkedin","decision":"include|optional|exclude","reason":"...","format":"single narrative post","adaptationNotes":["..."]},
    {"destination":"x","decision":"include|optional|exclude","reason":"...","format":"single post or short thread","adaptationNotes":["..."]}
  ],
  "mediaRequirements": [
    {"type":"text_only|none|single_image|screenshot|diagram|carousel|short_video","reason":"...","required":false}
  ],
  "sequencingNotes": ["optional ordering/timing note"]
}`;
}

export function acceptNarrativeStrategyProposal(raw) {
  return normalizeStrategyProposal(safeRecord(raw));
}
