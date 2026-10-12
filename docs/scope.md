# Summit: Scope

## Concept

A daily trivia game where the player climbs a mountain. Each prompt is a step on the climb. Common answers keep the player on the well-marked trail. Rare answers lead off the path toward the summit, and the rarer the answer, the higher the altitude gain.

The game is inspired by Krillion.io, a trivia "deep dive" game, but uses a mountain climb theme instead of a descent.

## Purpose

- Deliver a short, satisfying daily ritual that takes under two minutes.

## Format

- One daily run with the same prompts for every player.
- About seven prompts per run.
- No accounts. Progress is kept on the player's device.
- Under two minutes per run.

## Core Mechanic

- Each prompt has a set of accepted answers. Each answer has a rarity level.
- The player types an answer. Common answers give small altitude gains. Rare answers give large gains.
- A prompt allows unlimited attempts. A wrong answer gains no altitude, keeps the player on the same prompt, and does not change the timer. The player can keep trying until the prompt is answered correctly or time runs out. Submitting a blank answer does nothing.
- Each prompt has a 30-second timer. When time runs out, the prompt gains no altitude and the run moves on to the next prompt. Text typed but not submitted is not scored.
- The run ends when the player reaches the summit or after the last prompt.
- Autocorrect and alias matching should be forgiving enough to feel fair, without accepting clearly wrong answers.

### Altitude Scoring

The summit is 8,848 m. Each answer belongs to one of five rarity tiers with a fixed altitude gain. All prompts carry equal weight. The altitude meter is capped at 8,848 m, but gains are added as raw values, so a near-perfect run reaches the summit.

| Tier | Rarity | Gain per answer |
|---|---|---|
| 1 | Common | 130 m |
| 2 | Uncommon | 350 m |
| 3 | Rare | 650 m |
| 4 | Very rare | 1,000 m |
| 5 | Legendary | 1,400 m |

Reference runs (7 prompts):

| Run | Altitude | Reaches summit |
|---|---|---|
| All common | 910 m | No |
| All uncommon | 2,450 m | No |
| All rare | 4,550 m | No |
| All very rare | 7,000 m | No |
| 6 legendary + 1 uncommon | 8,750 m | No |
| 6 legendary + 1 rare | 9,050 m (shown as 8,848 m) | Yes |
| 5 legendary + 2 very rare | 9,000 m (shown as 8,848 m) | Yes |

Design rules:

- Six legendary answers total 8,400 m, so the summit can only be reached on the final prompt and every run lasts all seven prompts.
- Every prompt needs at least one accepted answer in the legendary tier, otherwise that day's summit is impossible.
- Tier cutoffs are set from each answer's familiarity score, with manual overrides where a score does not work well.

## Experience

- A start screen with a short description, three key facts (question count, time per prompt, summit height) and a Start button opens each run. The first prompt and its timer begin only after Start is clicked. A player who already finished today's run goes straight to the result.
- Painterly visual style with soft gradients and a muted palette.
- An interactive background with layered mountains, drifting clouds, and weather that reacts to the player's progress.
  - The scenery passes through four zones as altitude rises: forest foothills with valley mist, alpine rock with circling birds, a glacier snowstorm, and a clear death zone with stars and a sea of clouds below, ending in a sunrise at the summit.
  - Weather depends only on altitude.
  - Every zone keeps a slight ambient motion at all times (a warm dawn glow, drifting pollen, swaying pines and rolling mist in the foothills with a brief wind gust every ten seconds or so that bends the pines and sweeps pale wisps of air across the sky, breathing haze in the alpine, a pulsing storm, a swelling cloud sea and a softly pulsing sunrise), subtle enough to be felt rather than noticed.
  - Each answer plays a camera climb with no visible climber. Rarer answers climb longer and more dramatically: common answers take a gentle step, rare and above add an updraft, and very rare and legendary answers end in a golden glow. A timeout plays a small stumble with no climb; a wrong answer plays nothing, since the player stays on the same prompt.
- A simple, readable altitude meter as the main HUD element.
- No sound. The game is meant to feel calm and visual.

## Content Approach

- A hand-written starter set of prompts and answers, written by the creator.
- Additional answer sets drafted with Claude and reviewed by the creator before release.
- Rarity judgments come from a familiarity score for each answer, with manual overrides for prompts where a score does not work well.

## Success Criteria

- A player can complete a daily run in under two minutes.
- Rare answers feel rewarding, and common answers still feel fair.
- The background and altitude meter make progress visible without extra text.
- Wrong answer don't cost anything, it just doesn't gain altitude. 
- The project is presentable as a portfolio piece.

## Out of Scope (for now)

- User accounts, friends, and leaderboards.
- Monetization and ad removal.
- Multiplayer.
- Sound effects and music.
- Mobile app versions.
- Themed packs and an unlimited mode.