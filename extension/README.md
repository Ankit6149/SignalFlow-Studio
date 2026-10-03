# SignalFlow Studio Browser Extension — Experimental Scaffold

> **Status: experimental / not production capture.**
>
> This directory is a developer-only Chromium extension scaffold for capability discovery and future deliberate context delivery. It is not a released capture client and must not be described as durable ingestion, screenshot capture, recording, or offline upload.

## What works today

The extension can:

- store a SignalFlow Studio URL;
- find an already-open compatible Studio tab;
- request the versioned SignalFlow capability snapshot through the page bridge;
- show truthful ready/blocked/error states;
- read the current active-tab URL for the owner's note.

## What deliberately does not work yet

The extension does **not** currently provide:

- acknowledged durable context ingestion;
- screenshot capture;
- region/full-page capture;
- tab/window/screen recording;
- capture review, annotation, or redaction;
- offline retry/upload queues;
- browser-store release packaging or acceptance proof.

The current page bridge returns `acknowledged: false` for context dispatch. The background service therefore treats delivery as failed, and the Send action remains blocked unless the runtime capability contract explicitly declares extension delivery available.

Dispatching a DOM/tab message is not considered durable delivery.

## Local development

1. Run SignalFlow Studio locally.
2. Open a Chromium browser and visit `chrome://extensions/`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select this `extension` directory.
5. Open SignalFlow Studio in a browser tab.
6. Open the extension and point it at that Studio URL.
7. Use the capability status only to verify the handshake.

Do not use this scaffold as evidence that extension ingestion or capture is shipped.

## Product ownership

Capability truth is owned by:

- `frontend/app/api/capabilities/route.js`;
- `frontend/lib/capabilities/capabilityContract.mjs`;
- `docs/CAPABILITY_MATRIX.md`;
- the extension issues under #78–#85.

Any future extension implementation must preserve least-privilege permissions, explicit user initiation, privacy/redaction review where relevant, durable acknowledgement, retry/idempotency, and version compatibility.
