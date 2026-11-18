export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="6" className="fill-brand-navy" />
      <rect x="6" y="13" width="8" height="13" className="fill-white" />
      <rect x="17" y="7" width="9" height="19" className="fill-brand-blue" />
    </svg>
  );
}
