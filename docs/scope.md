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
  - Every zone keeps a slight ambient motion at all times (a warm dawn glow, drifting pollen, swaying pines and rolling mist in the foothills with a brief wind gust every ten seconds or so that bends the pines and sweeps pale wisps of air across the sky, breathing haze in the alpine, a pulsing storm, a swelling cloud sea and a softly pulsing sunrise), subtle enough to be felt rather than noticed. This motion follows an uneven, natural rhythm rather than a fixed beat: gusts vary in timing and strength and sometimes trail a weaker second puff, birds alternate flapping and gliding, and glows and storms swell irregularly.
  - During a run, a small painterly runner with a backpack and a beanie is seen side-on in the middle of the screen. It can roam across nearly the full width of the screen, but gets there in short strolls: between answers it walks a few steps left or right at uneven times, more often turning back toward the middle the further out it is. While the player types it comes in over the answer bar if it has wandered past its end, turns toward the bar's middle, bends over with its hands on its thighs to watch, and nods at the first keystroke and only now and then after. Standing between strolls it shifts its weight and now and then makes a small gesture, rarely the same one twice in a row: stretching, shaking out a leg, glancing back, bouncing, crouching, shading its eyes to gaze up the mountain, tugging its pack straps, scratching under its beanie, or resting its hands on its hips. During a climb it runs mostly upward, drifting only a short way to one side. It always faces the way it is heading, turning round quickly when it changes direction, and its whole body tilts a little into its motion, pitching nose up as a leap rises and nose down as it lands. There is no visible ground: it stands on a soft cushion of mist and runs up through the scenery itself, kicking up puffs of mist that drift down behind it. The mountain is one continuous world for the whole run, at a true scale of roughly a screen height per 1,150 m. The runner is hidden on the start and result screens.
  - Facts are pinned beside the runner's path at their real heights and scroll past on the way up, e.g. the top of the Burj Khalifa, Mont Blanc, Everest Base Camp and the Hillary Step. The scenery's zones are named at their starts (the foothills, the alpine zone, the glaciers, the death zone), ending at the summit. Each answer leaves a small pennant in its tier's colour where it landed, labelled with the tier and the answer.
  - The runner stays alive between answers. It breathes, and every few seconds, at uneven times, it makes one small gesture: stretching its arms overhead, shaking out a leg, glancing back down the mountain, bouncing on its toes, or dropping into a brief crouch. While the player types it shades its eyes and looks up the mountain. Under ten seconds it breathes faster and bounces restlessly. A wrong answer makes it shake its head, with no climb and no camera move.
  - Each answer plays a climb. The question drifts up and fades, and dashed chalk lines for all five tiers appear above the runner at the altitude each tier would reach, true to scale, each labelled with its tier and gain. The runner runs up hard, leaning into the slope with knees driving, heels kicking up behind and arms pumping, its body springing and its head nodding with each stride, with the answer riding above it in a chip, pulling ahead of the camera mid-climb before the camera catches up. Each line flashes in its tier's colour as the runner passes it, and the reached line glows on arrival. Rarer answers climb higher, faster and with bigger leaps, and every tier hops: common is a run ending in a small hop, uncommon two skips, rare a skip and a proper leap, very rare two big leaps, and legendary a skip and then one giant leap over the last lines, landing with both arms raised. The runner crouches to wind up before each leap, deeper for bigger ones, and crouches again to soak up the landing. Rare and above add an updraft, and very rare and legendary end in a golden glow. A timeout plays a stumble with no climb.
  - When the runner arrives, a landing banner pops up with the tier, the answer, the gain and a one-line quip for the tier, or "Out of time" after a timeout. The run waits there: the next prompt and its timer start only when the player clicks "Climb on". After the last prompt the button reads "See your climb" and leads to the result.
- A simple, readable altitude meter as the main HUD element.
- The run screen has three parts: the step count and question centered at the top, the runner in the middle, and the answer bar at the bottom. The answer bar holds a round timer on the left (seconds left in the center, ringed by an arc that drains clockwise and warms in color under ten seconds), the input, and a Climb button. Under ten seconds the screen's edges also throb softly in a warm colour.
- A wrong answer shows a short note just above the answer bar that fades on its own.
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