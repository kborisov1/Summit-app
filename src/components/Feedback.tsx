interface Props {
  miss: string;
}

/** A wrong answer costs nothing (scope "Success Criteria"); this just says so. */
export function Feedback({ miss }: Props) {
  return <p className="feedback feedback--miss">“{miss}” isn’t on the trail. Try again.</p>;
}
