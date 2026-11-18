"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { setCaseStatus } from "@/app/actions/cases";
import { FilesMark } from "@/components/files-mark";
import { PriorityBadge } from "@/components/priority-badge";
import { CASE_STATUSES, formatStatus, isCaseOverdue } from "@/lib/cases";
import type { CaseRow } from "@/lib/data";

export function CaseBoard({ rows, returnTo }: { rows: CaseRow[]; returnTo: string }) {
  const dragging = useRef<number | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={`mt-4 flex gap-3 overflow-x-auto pb-3 ${pending ? "opacity-70" : ""}`}>
      {CASE_STATUSES.map((status) => {
        const cards = rows.filter((row) => row.status === status);
        return (
          <section
            key={status}
            aria-label={formatStatus(status)}
            data-status={status}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("text/plain");
              const number = dragging.current ?? Number(raw);
              dragging.current = null;
              if (!Number.isInteger(number) || number < 1) return;
              const data = new FormData();
              data.set("number", String(number));
              data.set("status", status);
              data.set("returnTo", returnTo);
              startTransition(() => {
                void setCaseStatus(data);
              });
            }}
            className="flex w-52 shrink-0 flex-col rounded-xl border border-dashed border-line bg-page p-3"
          >
            <h2 className="text-sm font-medium text-brand-navy">
              {formatStatus(status)} <span className="text-muted">({cards.length})</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {cards.map((row) => (
                <li key={row.id}>
                  <article
                    draggable
                    aria-label={`Case ${row.number} ${row.subject}`}
                    data-case-number={row.number}
                    onDragStart={(event) => {
                      dragging.current = row.number;
                      event.dataTransfer.setData("text/plain", String(row.number));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-lg border border-line bg-card p-3 active:cursor-grabbing"
                  >
                    <p className="text-xs text-muted">#{row.number}</p>
                    <Link
                      href={`/cases/${row.number}`}
                      draggable={false}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {row.subject}
                    </Link>
                    <p className="mt-2 text-sm text-muted">{row.typeName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={row.priority} />
                      {row.hasFiles ? <FilesMark /> : null}
                      {isCaseOverdue(row) ? <span className="text-xs font-medium text-danger">Overdue</span> : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
