export function WorkOrderMark() {
  return (
    <span title="Has work orders" className="inline-flex text-brand-blue">
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          d="M1.5 8.2 14.5 2.2 8.8 14.2 7.2 8.8 1.5 8.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M7.2 8.8 14.5 2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="sr-only">Has work orders</span>
    </span>
  );
}
