import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
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

export function TextArea({
  label,
  name,
  error,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? name;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
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

export function CheckField({
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
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        <input
          {...props}
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="size-4 accent-brand-navy"
        />
        {label}
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FileField({
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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={name}
        type="file"
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
