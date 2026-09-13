# GP2 Runtime Negative-Control Probe — 2026-09-14

This file is a controlled production-acceptance probe for SignalFlow Golden Path 2.

It intentionally introduces **no product capability, user-facing behavior, architecture change, release, or substantive project milestone**. Its only purpose is to create a real merged GitHub pull-request event after the manifest-backed source runtime repair reached production.

Expected SignalFlow behavior:

- verify and accept the GitHub webhook;
- persist one canonical source signal idempotently at the exact merge revision;
- refresh only bounded repository evidence required by the source workflow;
- treat this change as low-value operational noise and **do not promote it into a content opportunity**;
- retain enough sanitized acceptance evidence to prove the negative-control path.

If this probe becomes a publishable content opportunity, the GP2 noise gate has failed its acceptance intent.
