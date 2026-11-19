"use client";

import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AuDateField } from "@/components/au-date-field";
import { checkedValue, textValue } from "@/lib/form-values";
import { useSubmittedValues } from "@/components/retained-form";

const controlClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

export function TextField({
  label,
  name,
  error,
  defaultValue,
  value,
  onChange,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? name;
  const submitted = useSubmittedValues();
  const describedBy = error ? `${id}-error` : undefined;
  const raw = value === undefined ? textValue(submitted, name, defaultValue) : value;
  const current = raw == null ? "" : String(raw);
  const { type, ...rest } = props;
  const dateKind = type === "datetime-local" ? "datetime-local" : type === "date" ? "date" : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {dateKind ? (
        <AuDateField
          {...rest}
          kind={dateKind}
          id={id}
          name={name}
          iso={dateKind === "date" ? current.slice(0, 10) : current}
          controlled={value !== undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={rest.required ? true : undefined}
          className={controlClass}
          onIso={(iso) => onChange?.({ target: { value: iso, name } } as ChangeEvent<HTMLInputElement>)}
        />
      ) : (
        <input
          {...rest}
          type={type}
          id={id}
          name={name}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={rest.required ? true : undefined}
          className={controlClass}
          {...(value === undefined ? { defaultValue: current } : { value: current })}
        />
      )}
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
  defaultValue,
  value,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = props.id ?? name;
  const submitted = useSubmittedValues();
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
        {...(value === undefined ? { defaultValue: textValue(submitted, name, defaultValue) } : { value })}
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
  defaultValue,
  value,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? name;
  const submitted = useSubmittedValues();
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
        {...(value === undefined ? { defaultValue: textValue(submitted, name, defaultValue) } : { value })}
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
  defaultChecked,
  checked,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? name;
  const submitted = useSubmittedValues();
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
          {...(checked === undefined ? { defaultChecked: checkedValue(submitted, name, defaultChecked) } : { checked })}
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
