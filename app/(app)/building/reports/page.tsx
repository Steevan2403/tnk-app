import type { Metadata } from "next";
import { deleteGeneratedReport, emailGeneratedReport } from "@/app/actions/reports";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ReportBuilder } from "@/components/report-builder";
import { CASE_PRIORITIES, CASE_STATUSES, formatPriority, formatStatus } from "@/lib/cases";
import { monthPeriod } from "@/lib/reports";
import { formatIsoDate } from "@/lib/contractors";
import { loadReportCatalog } from "@/lib/report-data";
import { requireUser } from "@/lib/data";
import { canManageReports } from "@/lib/roles";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Reports</h1>
        <p className="mt-4 text-muted">Select a building to see its reports.</p>
      </section>
    );
  }

  const canManage = canManageReports(user.role);
  const catalog = await loadReportCatalog(user.selectedBuildingId);
  const period = monthPeriod();
  const generated = first(params.generated) === "1";
  const emailed = first(params.emailed) === "1";
  const emailError = first(params.error) === "email";

  return (
    <section>
      <h1 className="font-serif text-3xl">Reports</h1>
      <p className="mt-2 max-w-2xl text-muted">Period reports of the work at this building.</p>
      {generated ? <p className="mt-4 rounded-md bg-card px-3 py-2 text-sm ring-1 ring-line">The report is ready.</p> : null}
      {emailed ? <p className="mt-4 rounded-md bg-card px-3 py-2 text-sm ring-1 ring-line">The report is in the outbox.</p> : null}
      {emailError ? (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          Enter an email address.
        </p>
      ) : null}
      {canManage ? (
        <ReportBuilder
          initialFrom={formatIsoDate(period.from)}
          initialTo={formatIsoDate(period.to)}
          cases={catalog.cases}
          types={catalog.types}
          companies={catalog.companies}
          assets={catalog.assets}
          apartments={catalog.apartments}
          statuses={CASE_STATUSES.map((status) => ({ id: status, label: formatStatus(status) }))}
          priorities={CASE_PRIORITIES.map((priority) => ({ id: priority, label: formatPriority(priority) }))}
        />
      ) : null}
      <section aria-labelledby="generated-reports" className="mt-10">
        <h2 id="generated-reports" className="text-xl font-medium text-brand-navy">
          Generated reports
        </h2>
        {catalog.reports.length === 0 ? (
          <p className="mt-3 text-muted">No reports yet</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
            {catalog.reports.map((report) => (
              <li key={report.id} className="px-4 py-3">
                <p className="font-medium">{report.periodLabel}</p>
                <p className="text-sm text-muted">
                  {report.formatLabel} · {report.createdLabel} · {report.createdByName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <a
                    href={`/api/reports/${report.id}/file`}
                    download={report.fileName}
                    className="text-brand-blue hover:underline"
                    aria-label={`Download ${report.formatLabel} for ${report.periodLabel}`}
                  >
                    Download
                  </a>
                  {canManage ? (
                    <form action={deleteGeneratedReport}>
                      <input type="hidden" name="id" value={report.id} />
                      <ConfirmSubmit label="Delete" message="Delete this report?" className="text-sm text-danger hover:underline" />
                    </form>
                  ) : null}
                </div>
                {canManage ? (
                  <form action={emailGeneratedReport} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={report.id} />
                    <div>
                      <label htmlFor={`email-${report.id}`} className="mb-1 block text-sm font-medium">
                        Recipient
                      </label>
                      <input
                        id={`email-${report.id}`}
                        name="to"
                        type="email"
                        required
                        autoComplete="email"
                        className="w-64 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40"
                      />
                    </div>
                    <button type="submit" className="rounded-md border border-line bg-white px-3 py-2 text-sm hover:border-brand-blue">
                      Email report
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
