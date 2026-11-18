export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <rect x="6" y="13" width="8" height="13" fill="#f3efe6" />
      <rect x="17" y="7" width="9" height="19" fill="#c4843c" />
    </svg>
  );
}
