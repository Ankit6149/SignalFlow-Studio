# SignalFlow Studio — Client Ecosystem and Edge Agent Architecture

> **Status:** canonical target architecture. This document defines how Web, Mobile, Browser Extension, MCP clients, background workers, and a future Desktop Edge Agent cooperate as one SignalFlow product. It does not claim that every client described here exists today.

## 1. Product principle

SignalFlow should not become four disconnected applications with duplicated state and business rules.

The target is one canonical SignalFlow application/domain system with multiple clients optimized for different contexts:

```text
                         SIGNALFLOW CORE
                              │
      ┌───────────────┬───────┼───────────┬─────────────────┐
      │               │       │           │                 │
     Web            Mobile   MCP/API   Browser Extension  Desktop Agent
      │               │       │           │                 │
 planning/review   judgment  agent use  browser context   private/local work
 create/library   quick input           capture           desktop capture
 calendar         approvals             research          local models
 settings         notifications                           local repos/files
```

The clients call the same application services and operate on the same canonical records.

## 2. Responsibility split

### 2.1 Web application

The web application remains the richest normal product workspace.

Primary responsibilities:

- Today decision inbox;
- Signals browsing;
- opportunity/angle selection;
- Plan / Campaign narrative management;
- Create/manual input;
- long-form Review;
- text/media revision inspection;
- Assets/Library;
- Calendar;
- Connections;
- Voice/Identity;
- workspace/project settings;
- advanced provider/privacy settings;
- diagnostics/admin where appropriate.

The web client should not become the only place where work can continue. Background jobs and user attention flows must survive browser closure.

### 2.2 Mobile application

The phone is the **judgment and capture-of-thought device**.

It should optimize for low attention rather than reproduce every desktop/web control.

Primary responsibilities:

- notifications requiring judgment;
- Today inbox;
- approve/reject/request changes;
- quick opportunity/angle selection;
- manual thought entry;
- voice notes;
- camera/photo input;
- screenshot/file/share-sheet input;
- quick context addition;
- Calendar overview;
- publication success/failure/attention state;
- connection/session alerts;
- concise history;
- optional lightweight on-device preprocessing.

The phone should make this possible:

```text
Notification:
"One thing from today may be worth posting."
        ↓
Open
        ↓
See why + 3 angles
        ↓
Choose one
        ↓
Later notification:
"Draft and visual are ready."
        ↓
Approve / Change
        ↓
Return to life/work
```

### 2.3 Browser extension

The browser extension is an **explicit user-initiated context/capture client**, not a surveillance system.

Primary responsibilities:

- capture current page context after user action;
- capture selected text;
- capture visible/region/full-page screenshots where supported;
- optional explicit tab/window recording;
- user note/description;
- choose project/campaign/inbox;
- review/redact before delivery;
- queue/retry delivery;
- durable acknowledgement.

The extension should not be the default passive tracker for services that have structured integrations.

Preferred:

```text
GitHub change → GitHub App/webhook
Linear change → future Linear integration
Notion change → future Notion integration
```

Not:

```text
browser extension watches every page and guesses what changed
```

### 2.4 MCP/API clients

MCP/API allow external agents or automations to use SignalFlow's canonical application services.

Potential clients:

- ChatGPT;
- Claude;
- Codex;
- Gemini CLI;
- IDE/agent systems;
- user's own automations.

MCP/API are interfaces. They do not own the domain model.

### 2.5 Background workers

Workers own durable asynchronous operations such as:

- source ingestion;
- inference tasks;
- asset processing;
- browser capture;
- screencast;
- image/media processing;
- render jobs;
- scheduled publishing;
- retries/reconciliation.

The web/mobile clients show state but do not keep these jobs alive through browser timers.

### 2.6 Desktop Edge Agent

A future lightweight desktop component handles capabilities that require trusted access to the user's machine.

Primary future responsibilities:

- local/private repositories;
- local files/folders explicitly authorized by the user;
- local SLM/runtime;
- custom local model endpoints;
- optional supported Codex/Claude Code/other local-agent adapters;
- private-hybrid preprocessing;
- desktop application capture/recording;
- desktop UI automation for bounded CaptureRecipes;
- device capability reporting;
- secure pairing with SignalFlow;
- receiving signed jobs when the user has opted in.

This component should initially be a small tray/menu-bar agent, not a second full SignalFlow UI.

## 3. One application, shared records

All clients should manipulate the same records:

```text
Workspace
Project
ContentSignal
ContentOpportunity
NarrativeStrategy
Campaign
ContentPiece
PlatformVariant
DraftRevision
Asset
MediaComposition
Approval
EditorialCalendarEntry
PublicationRequest
Publication
NarrativeMemory
FeedbackEvent
Identity/Voice profiles
InferenceTask
```

Example:

```text
phone creates manual thought
       ↓
ContentSignal
       ↓
web later opens same signal
       ↓
user selects opportunity
       ↓
worker generates media
       ↓
phone approves exact revision
       ↓
publication job executes
```

No client-specific duplicate Campaign type.

## 4. Mobile information architecture

The mobile experience should prioritize decisions.

Suggested primary navigation:

### Today

- opportunities needing a decision;
- content ready for review;
- schedule decisions;
- failed/unknown publication requiring attention;
- connection/privacy issues;
- intentionally empty editorial state as concise information.

### Capture

Fast entry options:

```text
Thought
Voice note
Photo
Screenshot
File
Link
Paste
Share from another app
```

Everything normalizes into a manual signal/asset/evidence flow.

### Calendar

- upcoming planned pieces;
- approval state;
- scheduled publication;
- move/skip/leave empty;
- concise campaign sequencing.

### Library

- recent/published/history;
- drafts needing attention;
- saved media/content.

### Profile/Settings

- account/session;
- notification preferences;
- connection/privacy summary;
- device/local agent status;
- deep settings can open web if not worth reproducing on mobile.

## 5. Mobile should not own heavy production

Do not force the phone to perform:

- long repository analysis;
- large video rendering;
- browser automation against web applications;
- multi-GB model inference when unsuitable;
- durable scheduled publication through local timers.

The phone requests/controls these tasks and displays their state.

Where on-device intelligence is available, it can reduce privacy/cost for lightweight preprocessing.

## 6. Mobile capture flows

### 6.1 Quick thought

```text
user types/speaks idea
    ↓
local transcription/preprocessing where available
    ↓
ContentSignal
    ↓
optional project/topic
```

Do not force campaign name/platform/model selection at capture time.

### 6.2 Share sheet

User shares:

- webpage;
- social post;
- image;
- PDF;
- file;
- video;
- text.

SignalFlow asks only essential intent:

```text
Save as reference
Use as evidence
I want to talk about this
Use this in a post
Something else
```

Then canonical SourceArtifact/Asset/Signal records are created.

### 6.3 Camera/photo

The user may capture:

- product/photo reference;
- event photo;
- physical sketch;
- handwritten note;
- whiteboard;
- real-world context.

The image may be:

- evidence/reference only;
- intended final media;
- intended source for editing;
- intended source for a carousel/video later.

This intent should be explicit or inferred with user confirmation when ambiguous.

## 7. Notifications

Notifications should reduce attention burden, not recreate social-media anxiety.

Useful notification classes:

### Needs judgment

- worthwhile opportunity ready;
- draft/media ready for approval;
- proposed schedule requires approval.

### Needs recovery

- provider/connection expired;
- capture failed;
- publication failed/unknown;
- privacy policy blocked a task.

### Informational

- publication confirmed;
- requested render completed;
- user-selected reminder/campaign milestone.

Avoid:

- constant low-value signal notifications;
- engagement gamification;
- notifications for every background step.

## 8. Browser extension privacy model

The extension must be explicit about:

- which page/tab/window is captured;
- which text/URL/metadata is sent;
- which workspace/project receives it;
- whether screenshots/recordings are included;
- whether private-page warnings apply;
- delivery status.

No hidden continuous browsing history collection.

## 9. Passive signals should use source integrations

The best source of structured work events is usually the service itself.

Examples:

```text
GitHub App/webhook
CI/release integration
future Linear/Jira/Notion integration
calendar events where authorized
```

The extension fills gaps where the user wants to intentionally capture context that has no better integration.

## 10. Optional `Watch this` capability

Later, SignalFlow may support narrowly scoped watches such as:

- this repository;
- this project;
- this page/document;
- this release feed;
- this explicitly selected research source.

A watch must define:

```text
watchId
source
scope
what may be observed
frequency/event source
retention
processing policy
workspace/project
pause/revoke
```

Do not implement broad browser-history monitoring as a shortcut.

## 11. Desktop Edge Agent architecture

Suggested logical components:

```text
Desktop Agent
├─ Pairing/session manager
├─ Device capability service
├─ Local file/repository bridge
├─ Local inference runtime adapter
├─ Private-hybrid preprocessing worker
├─ Desktop capture worker
├─ Desktop UI automation adapter
├─ Secure job receiver
├─ Upload/download manager
└─ Diagnostics / user controls
```

## 12. Pairing and trust

A desktop device must be explicitly paired to a workspace/user.

Suggested `PairedDevice` fields:

```text
deviceId
workspaceId
userId
deviceName
platform
agentVersion
publicKey/device credential ref
capabilities[]
processingPolicySupport[]
lastSeenAt
trustState
revokedAt?
```

The cloud should not treat a device as trusted because it can reach an endpoint.

## 13. Device capability contract

Desktop agent can report safe capability metadata:

```text
localInference.available
localInference.capabilityClasses[]
localFiles.enabled
localRepos.enabled
desktopCapture.available
desktopAutomation.available
supportedCaptureAPIs[]
GPU/RAM capability class
agentVersion
```

Avoid uploading detailed private machine inventory unless necessary.

## 14. Private repository flow through desktop agent

Example `PRIVATE_HYBRID` flow:

```text
GitHub/private-local event reference
        ↓
cloud creates bounded evidence request
        ↓
paired desktop agent receives signed job
        ↓
user/project authorization checked
        ↓
relevant source retrieved locally
        ↓
local summary/extraction/privacy scan
        ↓
minimal structured evidence uploaded
        ↓
cloud opportunity reasoning
```

The raw repository does not need to enter SignalFlow cloud storage.

## 15. Local files and folders

Access must be explicitly scoped.

Example:

```text
Allowed roots:
C:\Projects\SignalFlow
/Users/me/Projects/example
```

Rules:

- no arbitrary whole-disk access by default;
- symlink/path traversal boundaries;
- revoked root stops future jobs;
- raw file bytes follow processing policy;
- diagnostics never include private file content;
- deletion/revocation behavior documented.

## 16. Desktop application capture — future

Web capture is relatively straightforward because there is a URL/DOM/browser context.

Desktop applications require a separate bounded architecture.

Target abstraction:

```text
DesktopCaptureRecipe
    ↓
allowed application/window
    ↓
semantic UI controls/checkpoints where accessible
    ↓
safe actions
    ↓
window/screen capture
    ↓
canonical Asset
```

Potential `DesktopCaptureRecipe` fields:

```text
captureRecipeId
workspaceId
projectId
platform
applicationIdentity
allowedVersions?
windowSelector
steps[]
expectedCheckpoints[]
captureRules[]
privacyRules[]
audioPolicy
version
```

## 17. Desktop control vocabulary

Prefer semantic actions where the OS accessibility/UI automation system exposes them:

```text
launch_app
activate_window
find_control
invoke_control
focus_control
fill_control
select_control
wait_for_control
assert_control
scroll
pause
capture_checkpoint
start_recording
stop_recording
```

Avoid x/y pixel clicking as the primary contract because it is fragile and hard to audit.

## 18. Desktop capture safety

- explicit app/window allowlist;
- no recording other windows silently;
- visible device/agent capture state where practical;
- bounded duration;
- no hidden microphone capture;
- no background continuous desktop recording;
- expected UI checkpoints;
- privacy blockers for notifications/customer data/secrets;
- stop if unexpected app/window/origin appears;
- raw capture provenance.

## 19. Cloud-to-desktop capture jobs

A future flow can allow the user to request media from web/phone while a paired desktop handles capture.

Example:

```text
Phone: "Generate a demo"
        ↓
cloud MediaRequirement
        ↓
signed CaptureJob
        ↓
paired desktop agent
        ↓
allowed demo application
        ↓
DesktopCaptureRecipe
        ↓
record/screenshots
        ↓
encrypted/resumable upload
        ↓
media composition/render worker
        ↓
phone notification: "Demo ready"
```

The desktop must be online and explicitly enabled for this capability. If offline, the cloud should show `waiting_for_device` rather than silently failing or using another machine.

## 20. Edge job contract

Suggested job metadata:

```text
edgeJobId
workspaceId
deviceId
kind
resourceReferences[]
processingPolicyId
capabilityRequirements[]
expiresAt
idempotencyKey
status
attempt
```

States may include:

```text
queued
waiting_for_device
delivered
accepted
running
uploading
succeeded
failed
rejected
expired
cancelled
```

## 21. Signed job security

Requirements:

- device-bound authorization;
- short-lived signed job claims;
- replay protection;
- idempotency;
- workspace/project authorization;
- capability/processing-policy verification;
- no raw secrets in job payload;
- job expiration;
- explicit rejection reason;
- secure upload/download URLs or streams.

## 22. Local AI agent adapters

The Desktop Agent may later offer official adapters to installed developer agents if supported.

Examples of possible role:

```text
SignalFlow asks for technical repository explanation
        ↓
Desktop adapter invokes officially supported local agent mode
        ↓
agent works against authorized local repository
        ↓
structured evidence returned
```

Rules:

- optional;
- official supported interfaces only;
- never extract/reuse unsupported credentials;
- show which agent/account will process data;
- honor workspace processing policy;
- not required for cloud/background operation;
- failure does not lose canonical SignalFlow state.

## 23. Offline behavior

### Mobile

Can queue:

- thoughts;
- notes;
- capture metadata;
- user decisions where safe.

Must reconcile carefully when reconnecting, especially approvals/schedules.

### Extension

Can queue explicit captures with stable IDs and user-visible state.

### Desktop agent

Can queue locally produced results according to policy/retention limits.

### Cloud

Remains authoritative for hosted job/publication state.

## 24. Conflict handling

Examples:

- user approves on phone while text is being edited on web;
- web moves schedule while phone shows old schedule;
- desktop capture finishes after campaign media was replaced;
- extension retries a capture already acknowledged.

Use stable revision IDs, optimistic version checks, idempotency, and explicit supersession.

Approval always binds exact current revisions; a stale mobile screen cannot approve a different newer revision silently.

## 25. Authentication/session model

Each client type should have a fit-for-purpose session mechanism.

### Web/mobile

Normal user/session authentication.

### Extension

Paired/authenticated workspace session with narrow scopes.

### Desktop agent

Long-lived device identity + revocable secure session/credentials, separate from raw user password.

### MCP/API

Explicit OAuth/token/app authorization appropriate to the client and action.

Do not share one browser localStorage token across all clients.

## 26. Authorization must remain server/application owned

Clients can request actions; they do not decide permission.

Examples:

- mobile cannot approve another workspace's draft by changing an ID;
- extension cannot upload into a project it is no longer paired to;
- desktop cannot read a folder because a stale recipe references it after permission removal;
- MCP agent cannot publish unless its actor/scopes and approval policy permit it.

## 27. Privacy boundaries by client

### Web

- browser-local state today where implemented;
- future cloud data follows workspace policies.

### Phone

- local caches encrypted by platform capabilities;
- lock-screen notification content should avoid private details by default;
- share-sheet/camera uploads honor processing policy.

### Extension

- only explicit captures;
- no hidden history/password/cookie capture;
- redaction/review before sending sensitive screenshots.

### Desktop

- highest trust/private-access surface;
- least-privilege roots/apps;
- local-only mode must be technically enforced;
- private logs exclude source/capture content.

## 28. Product UI for device/client status

Connections or Settings may eventually show:

```text
Devices

Ankit's Windows PC
● Online
Private processing: Ready
Local model: Ready
Desktop capture: Enabled
Last seen: now
[Manage]

Phone
● Connected
Notifications: Enabled
Local preprocessing: Available

Browser Extension
● Chrome paired
Capture permissions: On demand
```

Do not imply an offline device can satisfy current capture/private-processing requirements.

## 29. Client capability discovery

The application should consume capability state such as:

```text
mobile.shareSheet
mobile.voiceCapture
extension.pageCapture
extension.screenRecording
desktop.localRepo
desktop.localInference
desktop.capture
desktop.automation
```

Capabilities are version/session/device-specific and can disappear.

## 30. Release sequencing

### Phase 1 — Web remains primary

- build Golden Path intelligence/review in web;
- durable jobs/cloud architecture where required.

### Phase 2 — Browser extension

- explicit page/text/screenshot capture;
- canonical Signal/Asset delivery.

### Phase 3 — Mobile companion

- Today;
- manual thought/voice/share input;
- review/approval/change requests;
- Calendar/status/notifications.

### Phase 4 — Desktop Edge Agent

- pairing;
- private repositories/local files;
- local inference;
- Private Hybrid.

### Phase 5 — Desktop application capture

- bounded desktop CaptureRecipes;
- screenshot/screencast;
- media-production integration.

The exact timing may shift based on product proof, but all phases should reuse one domain/application architecture.

## 31. What not to build

- no complete duplicated mobile Studio;
- no hidden browser surveillance;
- no automatic whole-disk desktop access;
- no continuous desktop recording;
- no phone-based heavy renderer as a requirement;
- no pixel-coordinate automation as the only desktop capture mechanism;
- no device trusted merely because it has a token;
- no client-specific duplicate business rules;
- no publication state owned by local timers.

## 32. Product rules

1. **Web is the full workspace; phone is the judgment device.**
2. **Extension captures deliberate browser context; structured integrations handle passive service events.**
3. **Desktop Agent owns trusted local/private capabilities and future desktop-app capture.**
4. **Workers own durable background execution.**
5. **MCP/API expose the same application services to agents.**
6. **All clients use stable shared domain records.**
7. **Approval is revision-specific across every client.**
8. **No client silently expands its observation scope.**
9. **Offline/retry behavior is explicit and idempotent.**
10. **Security/privacy are stricter on the desktop edge because it can access the most sensitive material.**

## 33. Definition of architectural success

The ecosystem is successful when a user can capture an idea from a phone, collect browser evidence through the extension, process a private repository through a paired desktop, review the resulting campaign on web, approve from mobile, and let cloud workers publish it—without any client inventing a separate source of truth or violating the workspace's processing policy.
