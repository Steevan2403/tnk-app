"use client";

import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import {
  AU_DATE_HINT,
  AU_DATE_TIME_HINT,
  formatAuDate,
  formatAuDateTime,
  parseAuDate,
  parseAuDateTime,
} from "@/lib/au-date";

type Kind = "date" | "datetime-local";

const parseFor = {
  date: parseAuDate,
  "datetime-local": parseAuDateTime,
} as const;

const formatFor = {
  date: formatAuDate,
  "datetime-local": formatAuDateTime,
} as const;

const hintFor = {
  date: AU_DATE_HINT,
  "datetime-local": AU_DATE_TIME_HINT,
} as const;

// Native date inputs follow the browser locale. In this Chromium they stay month-first
// even with lang="en-AU", so the field shows DD/MM/YYYY and posts the ISO value.
export function AuDateField({
  kind,
  id,
  name,
  iso,
  controlled,
  onIso,
  ...props
}: {
  kind: Kind;
  id: string;
  name: string;
  iso: string;
  controlled: boolean;
  onIso?: (iso: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "name" | "id" | "onChange">) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const emitted = useRef(iso);
  const display = draft ?? formatFor[kind](iso);
  const posted = parseFor[kind](display) ?? "";
  const formatHint = hintFor[kind];

  useEffect(() => {
    if (!controlled) return;
    if (iso === emitted.current) return;
    emitted.current = iso;
    setDraft(null);
  }, [controlled, iso]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    if (!display.trim()) field.setCustomValidity("");
    else if (!parseFor[kind](display)) field.setCustomValidity(`Use ${formatHint}.`);
    else field.setCustomValidity("");
  }, [display, formatHint, kind]);

  function change(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const parsed = parseFor[kind](next) ?? "";
    setDraft(parsed ? formatFor[kind](parsed) : next);
    emitted.current = parsed;
    if (hiddenRef.current) hiddenRef.current.value = parsed;
    onIso?.(parsed);
  }

  return (
    <>
      <input
        {...props}
        ref={inputRef}
        id={id}
        type="text"
        lang="en-AU"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder={props.placeholder ?? formatHint}
        title={formatHint}
        value={display}
        onChange={change}
      />
      <input ref={hiddenRef} type="hidden" name={name} value={posted} />
    </>
  );
}
