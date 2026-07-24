# Studio UX and Visual System

## Experience Goal

The Studio should feel like a luxurious creative writing room: calm, rich, focused, and confident. It should not feel like a crowded admin dashboard. The landing page can be expressive; the workspace must be denser, clearer, and more operational.

## Workflow Architecture

### Compose

1. **Source** — campaign name, source brief, links, repository, files, optional audience/model controls.
2. **Destinations** — grouped Social, Community, Video, and Owned channels.
3. **Generate** — a single visible command with a concise readiness summary.

### Review

- A destination rail switches between generated outputs.
- The editor is the visual centre.
- A side inspector shows route, character guidance, connector state, and source facts.
- Save, copy, open, export, and publish actions stay deliberate and consistently placed.
- The original brief is available by returning to Compose, not permanently occupying half of the review screen.

## `rem` Type Scale

| Role | Size |
|---|---:|
| Metadata | `0.75rem` |
| Supporting copy | `0.8125rem` |
| Body and controls | `0.875rem`–`0.9375rem` |
| Section title | `1.125rem`–`1.375rem` |
| Workspace title | `clamp(2rem, 3.2vw, 3.25rem)` |

Functional copy should not fall below `0.75rem` except decorative marks with an accessible label.

## Density

- Header target: `4rem`
- Standard field target: about `2.875rem`
- Standard button target: `2.75rem`
- Panel padding: `1.25rem`–`1.5rem`
- Panel radius: `1.125rem`–`1.375rem`
- Main textarea default: `9rem`–`10rem`, user-resizable

## Responsive Intent

- Above `86rem`: balanced two-column compose layout.
- At or below `86rem`: single-column compose layout for common laptops and high display scaling.
- Review uses a three-zone workspace on wide screens and collapses to two/one zones progressively.
- At low viewport height, reduce decorative vertical space before reducing readable text.

## Visual Language

- Warm paper canvas
- Obsidian command surfaces
- Champagne as the main highlight
- Coral for directional links and warnings
- Sage for confirmed states
- Soft shadows, subtle gradients, and tonal borders
- Playfair Display for selective identity moments
- DM Sans/Manrope for operational UI

## Interaction Principles

- Avoid nested vertical scroll areas when the page can scroll naturally.
- Do not permanently overlay a large command bar on laptop content.
- Make the current stage and next action obvious.
- Keep advanced model/provider settings collapsed by default.
- Use truthful language: configured, connected, expired, needs live test, manual handoff.
