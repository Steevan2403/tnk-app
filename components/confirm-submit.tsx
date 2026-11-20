"use client";

export function ConfirmSubmit({
  label,
  message,
  className,
  ariaLabel,
  role,
}: {
  label: string;
  message: string;
  className?: string;
  ariaLabel?: string;
  role?: "menuitem";
}) {
  return (
    <button
      type="submit"
      role={role}
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
