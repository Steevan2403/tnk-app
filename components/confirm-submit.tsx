"use client";

export function ConfirmSubmit({
  label,
  message,
  className,
  ariaLabel,
}: {
  label: string;
  message: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
