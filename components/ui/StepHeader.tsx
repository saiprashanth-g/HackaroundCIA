export function StepHeader({
  step,
  total,
  label,
  title,
  sub,
}: {
  step: number;
  total: number;
  label: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="max-w-2xl">
      <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-navy-mid">
        Step {step} of {total} <span className="text-gold">&middot;</span> {label}
      </p>
      <h1 className="font-serif text-4xl leading-tight tracking-tightish text-ink sm:text-5xl">
        {title}
      </h1>
      {sub ? (
        <p className="mt-5 text-lg leading-relaxed text-navy-mid">{sub}</p>
      ) : null}
    </header>
  );
}
