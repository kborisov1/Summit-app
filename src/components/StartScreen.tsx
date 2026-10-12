interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <section className="card start" aria-labelledby="start-title">
      <h2 id="start-title" className="start__title">
        Climb the mountain
      </h2>
      <p className="start__text">
        Answer seven questions with the first thing that comes to mind. The rarer your answer, the higher you climb.
        You get 30 seconds for each.
      </p>
      <button type="button" className="button start__button" onClick={onStart} autoFocus>
        Start
      </button>
    </section>
  );
}
