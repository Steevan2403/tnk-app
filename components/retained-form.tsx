"use client";

import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { valuesKey, type SubmittedValues } from "@/lib/form-values";

const SubmittedContext = createContext<SubmittedValues | undefined>(undefined);

export function useSubmittedValues(): SubmittedValues | undefined {
  return useContext(SubmittedContext);
}

function fieldsNamed(form: HTMLFormElement, name: string): Element[] {
  const named = form.elements.namedItem(name);
  if (!named) return [];
  if (named instanceof Element) return [named];
  return Array.from(named);
}

function restoreForm(form: HTMLFormElement, values: SubmittedValues) {
  for (const [name, raw] of Object.entries(values)) {
    const wanted = Array.isArray(raw) ? raw : [raw];
    const fields = fieldsNamed(form, name);
    fields.forEach((field, index) => {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
        field.checked = wanted.includes(field.value);
        return;
      }
      if (field instanceof HTMLInputElement && field.type === "file") return;
      field.value = wanted[index] ?? "";
    });
  }
}

export function RetainedForm({
  values,
  children,
  ...props
}: { values?: SubmittedValues; children: ReactNode } & Omit<ComponentProps<"form">, "children">) {
  const ref = useRef<HTMLFormElement>(null);
  const key = valuesKey(values);
  useLayoutEffect(() => {
    if (!values || !ref.current) return;
    restoreForm(ref.current, values);
  }, [key, values]);

  return (
    <form {...props} key={key} ref={ref}>
      <SubmittedContext.Provider value={values}>{children}</SubmittedContext.Provider>
    </form>
  );
}
