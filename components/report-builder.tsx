"use client";

import { useActionState, useState } from "react";
import { generateReport, type ReportFormState } from "@/app/actions/reports";
import { CheckField, TextField } from "@/components/field";
import { PriorityBadge } from "@/components/priority-badge";
import { formatStatus } from "@/lib/cases";
import { formatCalendarDate, formatIsoDate, parseDateOnly } from "@/lib/contractors";
import {
  REPORT_SECTIONS,
  defaultSections,
  lastQuarterPeriod,
  monthPeriod,
  selectReportCases,
  type ReportSections,
  type SectionKey,
} from "@/lib/reports";

const controlClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40";

export type BuilderCase = {
  id: string;
  number: number;
  startDate: string;
  completedLabel: string;
  subject: string;
  typeId: string;
  typeName: string;
  status: string;
  priority: string;
  includeInReport: boolean;
  companyIds: string[];
  companyNames: string[];
  assetIds: string[];
  apartmentId: string | null;
};

export type BuilderOption = { id: string; label: string };

export function ReportBuilder({
  initialFrom,
  initialTo,
  cases,
  types,
  companies,
  assets,
  apartments,
  statuses,
  priorities,
}: {
  initialFrom: string;
  initialTo: string;
  cases: BuilderCase[];
  types: BuilderOption[];
  companies: BuilderOption[];
  assets: BuilderOption[];
  apartments: BuilderOption[];
  statuses: BuilderOption[];
  priorities: BuilderOption[];
}) {
  const [state, action, pending] = useActionState(generateReport, {} as ReportFormState);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [includeOpen, setIncludeOpen] = useState(false);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [priorityIds, setPriorityIds] = useState<string[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [apartmentIds, setApartmentIds] = useState<string[]>([]);
  const [sections, setSections] = useState<ReportSections>(defaultSections);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  const periodOk = Boolean(fromDate && toDate && fromDate.getTime() <= toDate.getTime());
  const matching = periodOk
    ? selectReportCases(
        cases.map((item) => ({
          ...item,
          startDate: parseDateOnly(item.startDate) ?? new Date(0),
        })),
        {
          from: fromDate!,
          to: toDate!,
          includeOpen,
          typeIds,
          statuses: statusIds,
          companyIds,
          priorities: priorityIds,
          assetIds,
          apartmentIds,
          excludedIds: [],
        },
      )
    : [];

  function reset() {
    setFrom(initialFrom);
    setTo(initialTo);
    setIncludeOpen(false);
    setTypeIds([]);
    setStatusIds([]);
    setCompanyIds([]);
    setPriorityIds([]);
    setAssetIds([]);
    setApartmentIds([]);
    setSections(defaultSections());
    setUnticked(new Set());
  }

  function applyPeriod(period: { from: Date; to: Date }) {
    setFrom(formatIsoDate(period.from));
    setTo(formatIsoDate(period.to));
  }

  function toggleSection(key: SectionKey, checked: boolean) {
    setSections((current) => ({ ...current, [key]: checked }));
  }

  function toggleCase(id: string, checked: boolean) {
    setUnticked((current) => {
      const next = new Set(current);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const picks = [
    { label: "This month", period: monthPeriod() },
    { label: "Last month", period: monthPeriod(new Date(), -1) },
    { label: "Last quarter", period: lastQuarterPeriod() },
  ];

  return (
    <section aria-labelledby="report-builder" className="mt-8">
      <h2 id="report-builder" className="text-xl font-medium text-brand-navy">
        Report builder
      </h2>
      <form action={action} className="mt-4 space-y-6">
        {state.error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <TextField label="From" name="from" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="w-40">
            <TextField label="To" name="to" type="date" required value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {picks.map((pick) => (
              <button
                key={pick.label}
                type="button"
                onClick={() => applyPeriod(pick.period)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm hover:border-brand-blue"
              >
                {pick.label}
              </button>
            ))}
          </div>
        </div>
        <CheckField
          label="Include all open cases"
          name="includeOpen"
          value="1"
          checked={includeOpen}
          onChange={(event) => setIncludeOpen(event.target.checked)}
        />
        <p className="text-sm text-muted">Leave a filter clear to include every value.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MultiFilter id="report-type" label="Case type" name="typeId" options={types} value={typeIds} onChange={setTypeIds} />
          <MultiFilter id="report-status" label="Case status" name="status" options={statuses} value={statusIds} onChange={setStatusIds} />
          <MultiFilter id="report-company" label="Contractor" name="companyId" options={companies} value={companyIds} onChange={setCompanyIds} />
          <MultiFilter id="report-priority" label="Priority" name="priority" options={priorities} value={priorityIds} onChange={setPriorityIds} />
          <MultiFilter id="report-asset" label="Assets" name="assetId" options={assets} value={assetIds} onChange={setAssetIds} />
          <MultiFilter id="report-apartment" label="Apartments" name="apartmentId" options={apartments} value={apartmentIds} onChange={setApartmentIds} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Sections</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_SECTIONS.map((section) => (
              <CheckField
                key={section.key}
                id={`section-${section.key}`}
                label={section.label}
                name="section"
                value={section.key}
                checked={sections[section.key]}
                onChange={(event) => toggleSection(section.key, event.target.checked)}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-medium text-brand-navy">Matching cases</h3>
          <button type="button" onClick={reset} className="text-sm text-brand-blue hover:underline">
            Reset
          </button>
        </div>
        {!periodOk ? <p className="text-sm text-danger">Choose a start date and an end date.</p> : null}
        <p className="text-sm text-muted">{matching.length === 1 ? "1 case" : `${matching.length} cases`}</p>
        {matching.length === 0 ? (
          <p className="text-muted">No cases match.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Include</th>
                  <th className="px-3 py-2 font-medium">Case #</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium">Completed</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Contractor</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {matching.map((item) => {
                  const source = cases.find((row) => row.id === item.id);
                  return (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          name="caseId"
                          value={item.id}
                          checked={!unticked.has(item.id)}
                          aria-label={`Include case ${item.number}`}
                          onChange={(event) => toggleCase(item.id, event.target.checked)}
                          className="size-4 accent-brand-navy"
                        />
                      </td>
                      <td className="px-3 py-2">{item.number}</td>
                      <td className="px-3 py-2">{source ? formatCalendarDate(parseDateOnly(source.startDate) ?? new Date(0)) : ""}</td>
                      <td className="px-3 py-2">{source?.completedLabel || "-"}</td>
                      <td className="px-3 py-2">{item.subject}</td>
                      <td className="px-3 py-2">{item.typeName}</td>
                      <td className="px-3 py-2">{source?.companyNames.join(", ") || "None"}</td>
                      <td className="px-3 py-2">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-3 py-2">{formatStatus(item.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="format"
            value="pdf"
            disabled={pending || !periodOk}
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60"
          >
            {pending ? "Generating…" : "Generate PDF"}
          </button>
          <button
            type="submit"
            name="format"
            value="xlsx"
            disabled={pending || !periodOk}
            className="rounded-md border border-brand-navy px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-navy hover:text-white disabled:opacity-60"
          >
            {pending ? "Generating…" : "Generate Excel"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MultiFilter({
  id,
  label,
  name,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  options: BuilderOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        multiple
        value={value}
        size={Math.min(6, Math.max(options.length, 3))}
        onChange={(event) => onChange([...event.target.selectedOptions].map((option) => option.value))}
        className={controlClass}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
