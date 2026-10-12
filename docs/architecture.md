# Summit: Architecture

## Overview

Summit is a static React single-page app. It has no backend, no accounts, and no runtime AI calls. Every player gets the same daily prompts, so the content ships with the app and the day's prompt is picked on the device. Progress lives in the browser.

The build output is plain static files, so the game can be hosted on any static host. Hosting is deferred.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript | Strict mode on |
| Framework | React | Function components and hooks only |
| Build | Vite | Dev server and production bundle |
| Background | `<canvas>` in a React component | Animated with `requestAnimationFrame` |
| HUD and UI | React components with plain CSS | No UI component library |
| Run state | `useReducer` | Small enough that no state library is needed |
| Answer matching | Custom normalization, alias lookup, and Damerau-Levenshtein distance | Fuse.js (Apache 2.0) is the fallback if custom matching gets messy |
| Persistence | `localStorage` | Stores progress, streaks, and the last completed day |
| Tests | Vitest and React Testing Library | Unit tests for matching and daily selection, component tests for the run flow |
| Source control | GitHub | |

All dependencies are free and open source. No paid services are part of the stack.

## Content and Data Model

Prompts and answers are JSON files in the repository. They are loaded at build time and bundled with the app.

Each prompt has an id, a question, a list of accepted answers, and optional known wrong answers. Each answer has a canonical form, optional aliases, and a `rarity` value. The rarity value is the tier number from scope "Altitude Scoring" (1 to 5), where higher means rarer and gives a larger altitude gain.

Each daily run is one prompt set, stored as one file in `content/sets/<id>.json`. The types live in `src/game/types.ts`, and `src/game/validate.ts` checks every shipped set in the test suite, so a set that breaks a scope rule fails `make test`.

Content lives in `content/` and is separate from code, so new prompt sets can be added without touching components.

Rarity values come from an offline Node script. The script queries Wikipedia pageview counts from the Wikimedia REST API and converts them to a familiarity score. The output is written to the JSON files, and the creator can override any value by hand. The script runs only when content is updated, never in the browser.

## Daily Selection

The day's prompts are chosen deterministically from the local date. Take the day number since a fixed epoch (2026-01-01, day 0), then index into the prompt sets, ordered by id, with that number modulo the number of sets.

The local date is used so that a player sees the same run all day. Because the logic is pure and deterministic, it is easy to unit test, and it needs no server.

A small number of prompts per run is fixed at about seven, as set out in the scope.

## Answer Matching

Matching runs in this order:

1. Normalize the input: lowercase, trim, strip punctuation and diacritics, collapse whitespace.
2. Look up the normalized input in the answer and alias map.
3. If there is no exact match, compare against known answers with edit distance, allowing a small typo budget that scales with answer length.
4. Reject anything that is too far from every accepted answer.

Each prompt can record known wrong answers so that near misses that are clearly incorrect are rejected. Matching logic is pure TypeScript with no React dependency.

## Rendering

The background is a single full-screen canvas behind the UI. It draws layered mountains, drifting clouds, and weather that changes with the altitude gained. Rendering uses canvas gradients and procedural noise, with no image assets.

The animation loop runs in a `useEffect` and reads progress from a ref, so the React render cycle is not tied to frame updates. The loop pauses when the tab is hidden and respects `prefers-reduced-motion`.

The altitude meter is a regular React component, not part of the canvas, so it stays readable and accessible.

## State and Persistence

The run is held in a reducer with states for prompt index, altitude, answers given, and run status. Completing a run writes the result to `localStorage` under a versioned key so the format can change later without breaking saved data.

Stored data includes the last completed day, the current streak, and per-day results. There is no personal data beyond what the player types as answers, and nothing leaves the device.

## Project Structure

The layout below is scaffolded. Directories are empty placeholders until features land.

```
summit/
├── content/            # prompts and answers (JSON)
├── scripts/            # offline rarity script (Node)
├── src/
│   ├── components/     # React UI: HUD, prompt card, run screen
│   ├── background/     # canvas rendering for mountains, clouds, weather
│   ├── game/           # reducer, daily selection, scoring
│   ├── matching/       # normalization and answer matching
│   ├── storage/        # localStorage wrapper with versioned keys
│   └── main.tsx
├── tests/              # Vitest tests mirroring src/
├── docs/               # scope.md and architecture.md
└── Makefile            # thin wrappers over the npm scripts
```

Pure logic in `game/`, `matching/`, and `storage/` has no React imports, so it can be tested without rendering.

## Build and Deployment

`npm run dev` starts Vite. `npm run build` produces a static bundle in `dist/`. `npm test` runs Vitest.

Deployment is deferred. When hosting is chosen, the Vite `base` setting must match the hosting path. For GitHub Pages at a project path, that is the repository name.

## Constraints

- No backend, no database, no runtime AI calls.
- No paid services, licenses, or subscriptions in the build or the hosting plan.
- No sound, per the scope.
- No mobile app builds. The site should still work well in a mobile browser.

## Open Questions

- Hosting target and custom domain, to be decided when the game is ready.
