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

`scene.ts` draws one frame from the progress and the camera effects. `climb.ts` turns each answer's rarity into a timed camera move (travel, footstep sway, stumble shake, updraft, glow) and the runner's motion (stride phase, effort, stride width, leap height and tuck, crouch before take-off and after landing, cheer, stumble, and how far it leads the camera; each tier lists its leaps as windows of the climb), plus how visible the tier lines and the answer chip are and when the reached line lights. Travel finishes at `climbArrival`, a little before the climb ends, so the landing banner can appear on arrival while the lines fade. The mountain is one world measured in metres: `Background` tracks the camera's altitude and converts it to pixels at a fixed metres-per-screen scale. `silhouettes.ts` draws the edge ledges and what stands on them, pinned to the world by altitude at two parallax rates, and `atmosphere.ts` draws the cloud banks (a pass behind and a pass in front of the runner, plus a veil while the camera is inside one), the sun rays and the altitude vignette. Both read the camera's altitude and scale from `SceneView`, and share small painting helpers from `paint.ts`. `markers.ts` draws what is pinned to the world by altitude: the facts from `game/landmarks.ts` (shown only during a climb, fading with the tier lines), a pennant for each landing, the tier lines of the climb in progress, and the answer chip. `roam.ts` steps the runner's place across its lane each frame: where it heads (a short seeded stroll from where it stands, decided at uneven times and kept in its state, a short drift toward the roomier side during a climb, or in over the answer bar while the player types), its speed, which way it faces, its stroll leg cycle and its tilt from speed and leap pitch. `climber.ts` draws the runner side-on from the pose, mirrored to its facing and tilted about the hip, with no ground: it drops the body until the lower foot rests on the runner's line, and draws a mist cushion and footfall puffs in its place. It layers mood on top of the pose: watching the answer bar, tension, a head shake, a slow weight shift, and idle fidgets that are seeded from `time` like the ambient motion, each slot's pick shifted so it differs from the slot before's. `scene.ts` calls both and picks their colours from the zone. Both are pure and have no React imports. Ambient motion (tree sway, mist, haze, cloud swell) derives from `time` inside `scene.ts`, using smooth seeded noise and per-slot seeded gusts instead of pure sine waves, so it is aperiodic but still deterministic for a given `time`. With reduced motion, `time` stops, so the scene is still and jumps straight to the new altitude and skips the camera effects.

The animation loop runs in a `useEffect` and reads progress from a ref, so the React render cycle is not tied to frame updates. The loop pauses when the tab is hidden and respects `prefers-reduced-motion`.

The altitude meter is a regular React component, not part of the canvas, so it stays readable and accessible.

The UI decides where the climbing happens. The prompt card and the landing banner both render an empty box above the bottom bar, and `Background` reads that box's position each frame through a ref. It derives the runner's size, the base line the camera's altitude sits on near the box's bottom, and how far the runner may pull ahead up the box. Both screens give their bottom bar the same fixed height, and the landing banner floats over the box instead of taking room from it, so the runner keeps its size and place between them. The loop also eases toward any new measurement, so a layout change never makes the runner jump. CSS therefore controls the climbing area on every screen. When the box is not on the page, the runner and markers fade out.

The pause after each answer is UI state in `App`, not run state. `App` counts the results the player has dismissed; while a newer result exists it shows `Landing` instead of the next prompt, so the reducer and the per-prompt timer are unchanged and the timer starts only when the next `PromptCard` mounts. A finished run is saved as soon as its last answer lands, before the banner is dismissed.

The runner's mood comes from `cues` on `Background`: whether the field has text, whether time is low, and an id that changes with each wrong answer. `PromptCard` reports typing and low time up to `App` through callbacks, and `App` derives the miss id from the run state. The loop eases the mood toward the cues, so the runner settles into each change instead of snapping.

## State and Persistence

The run is held in a reducer with states for prompt index, altitude, answers given, and run status. The per-prompt timer (scope "Core Mechanic") lives in the prompt card and counts down against the wall clock, so it keeps running in a hidden tab. When it expires, the card dispatches a `timeout` action, which is recorded as a result with an empty input and no gain. Completing a run writes the result to `localStorage` under a versioned key so the format can change later without breaking saved data.

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

The game is hosted on GitHub Pages at `https://kborisov1.github.io/Summit-app/`. The Vite `base` setting is `/Summit-app/` and must match the repository name. A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs the tests, lint, and build on every push to `main`, then publishes `dist/` to Pages.

## Constraints

- No backend, no database, no runtime AI calls.
- No paid services, licenses, or subscriptions in the build or the hosting plan.
- No sound, per the scope.
- No mobile app builds. The site should still work well in a mobile browser.

## Open Questions

- Custom domain, to be decided when the game is ready.
