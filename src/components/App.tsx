import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Background } from '../background/Background';
import { promptSets as bundledSets } from '../game/content';
import { dayNumber, selectSet, toDayKey } from '../game/daily';
import { createRun, currentPrompt, runReducer, type RunState } from '../game/run';
import { hasReachedSummit } from '../game/scoring';
import type { PromptSet } from '../game/types';
import {
  browserStore,
  currentStreak,
  loadProgress,
  recordResult,
  saveProgress,
  type DayResult,
  type KeyValueStore,
} from '../storage/progress';
import { AltitudeMeter } from './AltitudeMeter';
import { Feedback } from './Feedback';
import { Landing } from './Landing';
import { PromptCard } from './PromptCard';
import { ResultScreen } from './ResultScreen';
import { StartScreen } from './StartScreen';
import { useKeyboardInset } from './useKeyboardInset';

interface Props {
  sets?: readonly PromptSet[];
  now?: Date;
  store?: KeyValueStore | null;
}

function toDayResult(run: RunState): DayResult {
  return {
    setId: run.setId,
    altitude: run.altitude,
    reachedSummit: hasReachedSummit(run.altitude),
    answers: run.results.map(({ promptId, input, answer, rarity }) => ({ promptId, input, answer, rarity })),
  };
}

export function App({ sets = bundledSets, now = new Date(), store = browserStore() }: Props) {
  useKeyboardInset();
  const todayKey = toDayKey(now);
  const [set] = useState(() => selectSet(sets, dayNumber(now)));
  const [saved] = useState(() => loadProgress(store));
  const [started, setStarted] = useState(false);
  const [run, dispatch] = useReducer(runReducer, set, createRun);
  const climberRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);
  const [lowTime, setLowTime] = useState(false);
  // Results the player has seen the landing banner for; the next prompt waits until then.
  const [seen, setSeen] = useState(0);

  // A finished run is folded into progress; an earlier result for today wins.
  const progress = useMemo(
    () => (run.status === 'finished' ? recordResult(saved, todayKey, toDayResult(run)) : saved),
    [run, saved, todayKey],
  );
  const today = progress.results[todayKey];

  useEffect(() => {
    if (run.status === 'finished') saveProgress(store, progress);
  }, [run.status, progress, store]);

  const altitude = today ? today.altitude : run.altitude;
  const prompt = currentPrompt(run);
  const lastResult = run.results.at(-1);
  const landing = run.results.length > seen ? lastResult : undefined;
  const climb = useMemo(
    () =>
      lastResult ? { id: run.results.length, rarity: lastResult.rarity, answer: lastResult.answer ?? '' } : null,
    [lastResult, run.results.length],
  );
  // Where each answer landed: the running total of the gains up to it.
  const landings = useMemo(
    () =>
      run.results.flatMap((r, i) =>
        r.rarity === null || r.answer === null
          ? []
          : [{ altitude: run.results.slice(0, i + 1).reduce((sum, x) => sum + x.gain, 0), rarity: r.rarity, answer: r.answer }],
      ),
    [run.results],
  );

  return (
    <>
      <Background
        altitude={altitude}
        climb={climb}
        landings={landings}
        climberAnchor={climberRef}
        cues={{ typing, lowTime, missId: run.miss ? `${run.results.length}-${run.miss.count}` : null }}
      />
      <div className={lowTime ? 'layout low-time' : 'layout'}>
        <header className="topbar">
          <h1 className="title">Summit</h1>
          <AltitudeMeter altitude={altitude} />
        </header>
        <main className={landing || (prompt && started && !today) ? 'stage stage--run' : 'stage'}>
          {landing ? (
            <Landing
              key={run.results.length}
              result={landing}
              question={run.prompts[run.results.length - 1].question}
              number={run.results.length}
              total={run.prompts.length}
              last={run.status === 'finished'}
              onContinue={() => setSeen(run.results.length)}
              climberRef={climberRef}
            />
          ) : today ? (
            <ResultScreen result={today} prompts={set.prompts} streak={currentStreak(progress, todayKey)} />
          ) : !started ? (
            <StartScreen onStart={() => setStarted(true)} />
          ) : prompt ? (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              number={run.promptIndex + 1}
              total={run.prompts.length}
              onSubmit={(input) => dispatch({ type: 'submit', input })}
              onTimeout={() => dispatch({ type: 'timeout' })}
              climberRef={climberRef}
              onTypingChange={setTyping}
              onLowTimeChange={setLowTime}
              notice={run.miss && <Feedback key={`miss-${run.results.length}-${run.miss.count}`} miss={run.miss.input} />}
            />
          ) : null}
        </main>
      </div>
    </>
  );
}
