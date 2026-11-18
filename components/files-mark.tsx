export function FilesMark() {
  return (
    <span title="Has files" className="inline-flex text-muted">
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path d="M4 1.5h5.2L13 5.3V14.5H4v-13z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 1.5V5.5h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="sr-only">Has files</span>
    </span>
  );
}
