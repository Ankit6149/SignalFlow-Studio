import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  evaluateExplicitBoundaryText,
  IDENTITY_PRECEDENCE,
  IDENTITY_RECORD_KINDS,
  normalizeBoundaryProfile,
  normalizeIdentityContextSnapshot,
  normalizeIdentityProfile,
  normalizePerceptionProfile,
  normalizePlatformExpressionProfile,
  normalizeProjectGuidanceProfile,
  normalizeVoiceProfile,
} from "../domain/identityProfiles.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function examples(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function publicFields(record) {
  if (!record) return {};
  const copy = { ...record };
  delete copy.schemaVersion;
  delete copy.kind;
  delete copy.profileSchemaVersion;
  delete copy.workspaceId;
  delete copy.userId;
  delete copy.version;
  delete copy.supersedesId;
  delete copy.createdAt;
  delete copy.updatedAt;
  for (const key of Object.keys(copy)) {
    if (/ProfileId$/.test(key)) delete copy[key];
  }
  return copy;
}

function profileId(record) {
  if (!record) return null;
  return record.identityProfileId
    || record.perceptionProfileId
    || record.voiceProfileId
    || record.boundaryProfileId
    || record.platformExpressionProfileId
    || record.projectGuidanceProfileId
    || null;
}

export function createIdentityApplication({
  identityRepository,
  workspaceId = "local-personal",
  userId = "owner",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("identityRepository", identityRepository);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const ownerUserId = required(userId, "userId");

  function owned(records) {
    return records.filter((record) => record.workspaceId === ownerWorkspaceId && record.userId === ownerUserId);
  }

  async function allRecords() {
    return owned(await repository.list());
  }

  function filterScope(record, { platform = null, projectId = null } = {}) {
    if (record.kind === IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION) return record.platform === platform;
    if (record.kind === IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE) return record.projectId === projectId;
    return true;
  }

  async function history(kind, scope = {}) {
    return (await allRecords())
      .filter((record) => record.kind === kind && filterScope(record, scope))
      .sort((left, right) => Number(right.version || 0) - Number(left.version || 0));
  }

  async function latest(kind, scope = {}) {
    return (await history(kind, scope))[0] || null;
  }

  async function nextVersion(kind, scope = {}) {
    const current = await latest(kind, scope);
    return { version: Number(current?.version || 0) + 1, supersedesId: profileId(current) };
  }

  function common(kind, idField, versionState, now) {
    return {
      kind,
      [idField]: appIds.create(kind.replace(/Profile$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()),
      workspaceId: ownerWorkspaceId,
      userId: ownerUserId,
      version: versionState.version,
      supersedesId: versionState.supersedesId,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function saveMinimalProfile(input = {}) {
    const now = appClock.now();
    const [identityVersion, perceptionVersion, voiceVersion, boundaryVersion, linkedinVersion, xVersion] = await Promise.all([
      nextVersion(IDENTITY_RECORD_KINDS.IDENTITY),
      nextVersion(IDENTITY_RECORD_KINDS.PERCEPTION),
      nextVersion(IDENTITY_RECORD_KINDS.VOICE),
      nextVersion(IDENTITY_RECORD_KINDS.BOUNDARY),
      nextVersion(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, { platform: "linkedin" }),
      nextVersion(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, { platform: "x" }),
    ]);

    const identity = normalizeIdentityProfile({
      ...common(IDENTITY_RECORD_KINDS.IDENTITY, "identityProfileId", identityVersion, now),
      primaryTopics: list(input.primaryTopics),
      expertise: list(input.expertise),
      interests: list(input.interests),
      worldviewNotes: String(input.worldviewNotes || "").trim() || null,
      recurringThemes: list(input.recurringThemes),
      personalityTraits: list(input.personalityTraits),
      backgroundContext: String(input.backgroundContext || "").trim() || null,
      technicalDepth: input.technicalDepth || "balanced",
      vulnerabilityPreference: input.vulnerabilityPreference || "selective",
      humorStyle: String(input.humorStyle || "").trim() || null,
      confidenceStyle: String(input.confidenceStyle || "calm and specific; avoid inflated certainty").trim(),
      approvedContextNotes: list(input.approvedContextNotes),
    });

    const perception = normalizePerceptionProfile({
      ...common(IDENTITY_RECORD_KINDS.PERCEPTION, "perceptionProfileId", perceptionVersion, now),
      qualitiesToSignal: list(input.qualitiesToSignal),
      qualitiesToAvoid: list(input.qualitiesToAvoid),
      desiredAudienceImpressions: list(input.desiredAudienceImpressions),
      longTermNarrative: list(input.longTermNarrative),
      currentPositioning: list(input.currentPositioning),
      credibilitySignals: list(input.credibilitySignals),
      antiPatterns: list(input.perceptionAntiPatterns),
    });

    const voice = normalizeVoiceProfile({
      ...common(IDENTITY_RECORD_KINDS.VOICE, "voiceProfileId", voiceVersion, now),
      writingPrinciples: list(input.writingPrinciples),
      dislikes: list(input.dislikes),
      openingPreferences: list(input.openingPreferences),
      openingAntiPatterns: list(input.openingAntiPatterns),
      preferredVocabulary: list(input.preferredVocabulary),
      bannedVocabulary: list(input.bannedVocabulary),
      rhythm: String(input.rhythm || "natural paragraph rhythm; vary sentence length without sounding scripted").trim(),
      emojiPolicy: input.emojiPolicy || "rare",
      hashtagPolicy: String(input.hashtagPolicy || "use only when they add real discovery value; never stuff hashtags").trim(),
      ctaStyle: String(input.ctaStyle || "do not force engagement; ask only when a genuine question belongs").trim(),
      formattingPreferences: list(input.formattingPreferences),
      storytellingPatterns: list(input.storytellingPatterns),
      technicalExplanationStyle: String(input.technicalExplanationStyle || "explain the decision and trade-off before implementation detail").trim(),
      approvedExamples: examples(input.approvedExamples),
      rejectedExamples: examples(input.rejectedExamples),
    });

    const boundary = normalizeBoundaryProfile({
      ...common(IDENTITY_RECORD_KINDS.BOUNDARY, "boundaryProfileId", boundaryVersion, now),
      blockedTopics: list(input.blockedTopics),
      blockedPeopleProjects: list(input.blockedPeopleProjects),
      blockedPhrases: list(input.blockedPhrases),
      unverifiedMetricsPolicy: input.unverifiedMetricsPolicy || "block",
      fabricatedVulnerabilityPolicy: input.fabricatedVulnerabilityPolicy || "block",
      exaggeratedLaunchLanguagePolicy: input.exaggeratedLaunchLanguagePolicy || "warn",
      customRules: list(input.customBoundaryRules).map((rule, index) => ({
        ruleId: `explicit-${index + 1}`,
        scope: "global",
        enforcement: "block",
        rule,
      })),
    });

    const linkedin = normalizePlatformExpressionProfile({
      ...common(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, "platformExpressionProfileId", linkedinVersion, now),
      platform: "linkedin",
      expressionRules: list(input.linkedinRules).length
        ? list(input.linkedinRules)
        : ["Use enough context to make the reasoning clear.", "Prefer reflection, decision, or lesson over launch hype."],
      preferredFormats: ["single_post", "carousel_when_sequential_explanation_helps"],
      narrativeDepth: "medium to deep when the idea earns it",
      concision: "concise but not compressed into slogans",
      ctaStyle: "no forced engagement question",
    });

    const x = normalizePlatformExpressionProfile({
      ...common(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, "platformExpressionProfileId", xVersion, now),
      platform: "x",
      expressionRules: list(input.xRules).length
        ? list(input.xRules)
        : ["Get to the observation quickly without becoming cryptic.", "Use a thread only when the idea cannot stay coherent in one post."],
      preferredFormats: ["single_post", "short_thread_when_needed"],
      narrativeDepth: "compact",
      concision: "high",
      ctaStyle: "avoid engagement bait",
    });

    const saved = [];
    for (const record of [identity, perception, voice, boundary, linkedin, x]) saved.push(await repository.upsert(record));
    return { identity: saved[0], perception: saved[1], voice: saved[2], boundary: saved[3], platformExpressions: { linkedin: saved[4], x: saved[5] } };
  }

  async function saveProjectGuidance(input = {}) {
    const projectId = required(input.projectId, "projectId");
    const now = appClock.now();
    const versionState = await nextVersion(IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE, { projectId });
    const record = normalizeProjectGuidanceProfile({
      ...common(IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE, "projectGuidanceProfileId", versionState, now),
      projectId,
      terminology: list(input.terminology),
      audience: list(input.audience),
      approvedFacts: list(input.approvedFacts),
      prohibitedClaims: list(input.prohibitedClaims),
      stage: String(input.stage || "").trim() || null,
      recurringThemes: list(input.recurringThemes),
      visualGuidance: list(input.visualGuidance),
    });
    return repository.upsert(record);
  }

  async function getActiveBundle({ platform = null, projectId = null } = {}) {
    const [identity, perception, voice, boundary, platformExpression, projectGuidance] = await Promise.all([
      latest(IDENTITY_RECORD_KINDS.IDENTITY),
      latest(IDENTITY_RECORD_KINDS.PERCEPTION),
      latest(IDENTITY_RECORD_KINDS.VOICE),
      latest(IDENTITY_RECORD_KINDS.BOUNDARY),
      platform ? latest(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, { platform }) : null,
      projectId ? latest(IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE, { projectId }) : null,
    ]);
    return { identity, perception, voice, boundary, platformExpression, projectGuidance };
  }

  async function getMinimalProfile() {
    const bundle = await getActiveBundle();
    const linkedin = await latest(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, { platform: "linkedin" });
    const x = await latest(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, { platform: "x" });
    return { ...bundle, platformExpressions: { linkedin, x } };
  }

  function refs(bundle) {
    const result = {};
    for (const [key, record] of Object.entries(bundle)) {
      if (!record) continue;
      result[key] = { id: profileId(record), version: record.version };
    }
    return result;
  }

  function effectiveRules({ boundary, voice, platformExpression, projectGuidance, campaignInstructions }) {
    const rules = [
      { precedence: "safety_authorization", source: "product", enforcement: "block", rule: "Never invent facts, permissions, private evidence, metrics, credentials, or publication state." },
      ...(boundary?.customRules || []).map((item) => ({ precedence: "explicit_boundary", source: "boundary", enforcement: item.enforcement, rule: item.rule })),
      ...(boundary?.blockedTopics || []).map((item) => ({ precedence: "explicit_boundary", source: "boundary", enforcement: "block", rule: `Do not communicate about: ${item}` })),
      ...(projectGuidance?.prohibitedClaims || []).map((item) => ({ precedence: "explicit_boundary", source: "project", enforcement: "block", rule: `Do not make the project claim: ${item}` })),
      ...list(campaignInstructions).map((item) => ({ precedence: "campaign_instruction", source: "campaign", enforcement: "apply", rule: item })),
      ...(platformExpression?.expressionRules || []).map((item) => ({ precedence: "platform_preference", source: platformExpression.platform, enforcement: "apply", rule: item })),
      ...(voice?.writingPrinciples || []).map((item) => ({ precedence: "global_identity_voice", source: "voice", enforcement: "apply", rule: item })),
      ...(voice?.dislikes || []).map((item) => ({ precedence: "global_identity_voice", source: "voice", enforcement: "avoid", rule: item })),
    ];
    return rules.sort((a, b) => IDENTITY_PRECEDENCE.indexOf(a.precedence) - IDENTITY_PRECEDENCE.indexOf(b.precedence));
  }

  async function createIdentityContextSnapshot({ platform = null, projectId = null, campaignInstructions = [] } = {}) {
    if (platform && !["linkedin", "x"].includes(platform)) throw new TypeError(`Unsupported Golden Path platform: ${platform}.`);
    const bundle = await getActiveBundle({ platform, projectId });
    const now = appClock.now();
    const snapshot = normalizeIdentityContextSnapshot({
      identityContextSnapshotId: appIds.create("identity-context"),
      workspaceId: ownerWorkspaceId,
      userId: ownerUserId,
      platform,
      projectId,
      profileRefs: refs(bundle),
      precedence: [...IDENTITY_PRECEDENCE],
      identity: publicFields(bundle.identity),
      perception: publicFields(bundle.perception),
      voice: publicFields(bundle.voice),
      boundaries: publicFields(bundle.boundary),
      platformExpression: publicFields(bundle.platformExpression),
      projectGuidance: publicFields(bundle.projectGuidance),
      campaignInstructions: list(campaignInstructions),
      effectiveRules: effectiveRules({
        boundary: bundle.boundary,
        voice: bundle.voice,
        platformExpression: bundle.platformExpression,
        projectGuidance: bundle.projectGuidance,
        campaignInstructions,
      }),
      createdAt: now,
    });
    return repository.upsert(snapshot);
  }

  async function evaluateBoundaries({ text, snapshotId }) {
    const stored = await repository.get(required(snapshotId, "snapshotId"));
    if (!stored || stored.kind !== IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT) throw new Error(`Identity Context Snapshot ${snapshotId} does not exist.`);
    if (stored.workspaceId !== ownerWorkspaceId || stored.userId !== ownerUserId) throw new Error("Identity Context Snapshot belongs to another owner/workspace.");
    return evaluateExplicitBoundaryText(text, stored);
  }

  return {
    saveMinimalProfile,
    saveProjectGuidance,
    getMinimalProfile,
    getActiveBundle,
    getProfileHistory: history,
    createIdentityContextSnapshot,
    evaluateBoundaries,
  };
}
