import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const controlClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/30";

export function TextField({
  label,
  name,
  error,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? name;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClass}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  children,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = props.id ?? name;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        {...props}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClass}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
