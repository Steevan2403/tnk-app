"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { saveAnswer } from "@/app/actions/inspections";
import { formatInspectionMark, type InspectionResult } from "@/lib/inspections";

const tones: Record<InspectionResult, string> = {
  pass: "bg-brand-green text-white",
  fail: "bg-danger text-white",
  na: "bg-brand-navy text-white",
};

export function ItemAnswer({
  runId,
  item,
  readOnly,
}: {
  runId: string;
  item: { id: string; name: string; result: InspectionResult | null; comment: string | null };
  readOnly: boolean;
}) {
  if (readOnly) {
    return (
      <div className="mt-3 space-y-2">
        <p>
          <span className="text-sm text-muted">Result </span>
          <ResultBadge result={item.result} />
        </p>
        {item.comment ? <p className="whitespace-pre-wrap">{item.comment}</p> : <p className="text-sm text-muted">No comment</p>}
      </div>
    );
  }

  return <AnswerFields runId={runId} item={item} />;
}

function AnswerFields({
  runId,
  item,
}: {
  runId: string;
  item: { id: string; name: string; result: InspectionResult | null; comment: string | null };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function queueSave() {
    clearTimer();
    timer.current = window.setTimeout(() => formRef.current?.requestSubmit(), 800);
  }

  return (
    <form ref={formRef} action={saveAnswer} className="mt-3 space-y-3" onSubmit={clearTimer}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="itemId" value={item.id} />
      <div role="group" aria-label={`Result for ${item.name}`} className="grid grid-cols-3 gap-2">
        <ResultButton name={item.name} value="pass" selected={item.result === "pass"} onPointerDown={clearTimer} />
        <ResultButton name={item.name} value="fail" selected={item.result === "fail"} onPointerDown={clearTimer} />
        <ResultButton name={item.name} value="na" selected={item.result === "na"} onPointerDown={clearTimer} />
      </div>
      <div>
        <label htmlFor={`comment-${item.id}`} className="mb-1 block text-sm font-medium">
          Comment
        </label>
        <textarea
          id={`comment-${item.id}`}
          name="comment"
          aria-label={`Comment for ${item.name}`}
          defaultValue={item.comment ?? ""}
          maxLength={2000}
          rows={3}
          onChange={queueSave}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40"
        />
      </div>
      <div>
        <label htmlFor={`photo-${item.id}`} className="mb-1 block text-sm font-medium">
          Photos
        </label>
        <input
          id={`photo-${item.id}`}
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          capture="environment"
          multiple
          aria-label={`Photo for ${item.name}`}
          className="w-full text-sm"
          onChange={() => {
            clearTimer();
            formRef.current?.requestSubmit();
          }}
        />
      </div>
      <SavingNote />
    </form>
  );
}

function ResultButton({
  name,
  value,
  selected,
  onPointerDown,
}: {
  name: string;
  value: InspectionResult;
  selected: boolean;
  onPointerDown: () => void;
}) {
  const label = value === "na" ? "N/A" : formatInspectionMark(value);
  return (
    <button
      type="submit"
      name="result"
      value={value}
      aria-pressed={selected}
      aria-label={`${formatInspectionMark(value)} ${name}`}
      onPointerDown={onPointerDown}
      className={`min-h-14 rounded-md px-2 py-3 text-base font-medium ${selected ? tones[value] : "bg-white text-ink ring-1 ring-line"}`}
    >
      {label}
    </button>
  );
}

function ResultBadge({ result }: { result: InspectionResult | null }) {
  const tone = result ? tones[result] : "bg-page text-ink ring-1 ring-line";
  return <span className={`inline-block rounded-md px-2 py-1 text-sm font-medium ${tone}`}>{formatInspectionMark(result)}</span>;
}

function SavingNote() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <p className="text-sm text-muted">Saving…</p>;
}
