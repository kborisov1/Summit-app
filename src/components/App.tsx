import { useEffect, useMemo, useReducer, useState } from 'react';
import { Background } from '../background/Background';
import { promptSets as bundledSets } from '../game/content';
import { dayNumber, selectSet, toDayKey } from '../game/daily';
import { createRun, currentPrompt, runReducer, type RunState } from '../game/run';
import { hasReachedSummit, SUMMIT_ALTITUDE } from '../game/scoring';
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
import { PromptCard } from './PromptCard';
import { ResultScreen } from './ResultScreen';
import { StartScreen } from './StartScreen';

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
  const todayKey = toDayKey(now);
  const [set] = useState(() => selectSet(sets, dayNumber(now)));
  const [saved] = useState(() => loadProgress(store));
  const [started, setStarted] = useState(false);
  const [run, dispatch] = useReducer(runReducer, set, createRun);

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

  return (
    <>
      <Background progress={Math.min(1, altitude / SUMMIT_ALTITUDE)} />
      <div className="layout">
        <header className="topbar">
          <h1 className="title">Summit</h1>
          <AltitudeMeter altitude={altitude} />
        </header>
        <main className="stage">
          {today ? (
            <ResultScreen result={today} prompts={set.prompts} streak={currentStreak(progress, todayKey)} />
          ) : !started ? (
            <StartScreen onStart={() => setStarted(true)} />
          ) : prompt ? (
            <>
              <div className="feedback-slot" aria-live="polite">
                {lastResult && <Feedback key={run.results.length} result={lastResult} />}
              </div>
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                number={run.promptIndex + 1}
                total={run.prompts.length}
                onSubmit={(input) => dispatch({ type: 'submit', input })}
                onTimeout={() => dispatch({ type: 'timeout' })}
              />
            </>
          ) : null}
        </main>
      </div>
    </>
  );
}
