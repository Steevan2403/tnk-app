import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CheckInForm } from "@/components/check-in-form";
import { formatAddress } from "@/lib/buildings";
import { closedVisitNotice, INVALID_CHECK_IN_LINK, openSiteVisit, prefilledContractorName } from "@/lib/check-in";
import { formatDateTime } from "@/lib/contractors";
import { getCheckInWorkOrder } from "@/lib/data";
import { workOrderNumber } from "@/lib/work-orders";

export const metadata: Metadata = { title: "On-site check-in" };

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const record = await getCheckInWorkOrder(token);
  if (!record) {
    return (
      <CheckInFrame>
        <h1 className="font-serif text-3xl">Check-in link</h1>
        <p className="mt-3 text-muted">{INVALID_CHECK_IN_LINK}</p>
      </CheckInFrame>
    );
  }

  const number = workOrderNumber(record.case.number, record.suffix);
  const open = openSiteVisit(record.visits);
  const notice = closedVisitNotice(record.status, open != null);

  return (
    <CheckInFrame>
      <p className="text-sm font-medium text-brand-navy">On-site check-in</p>
      <h1 className="mt-2 font-serif text-4xl">{number}</h1>
      <p className="mt-4 text-lg font-medium">{record.case.building.name}</p>
      <p className="text-muted">{formatAddress(record.case.building)}</p>
      <p className="mt-4">{record.case.subject}</p>
      {open ? (
        <p role="status" className="mt-4 rounded-lg bg-brand-green/10 px-3 py-3 text-sm">
          Checked in {formatDateTime(open.checkedInAt)} as {open.contractorName}.
        </p>
      ) : null}
      {notice ? <p className="mt-4 text-sm text-danger">{notice}</p> : null}
      {notice && !open ? null : (
        <CheckInForm
          token={token}
          action={open ? "check_out" : "check_in"}
          defaultName={prefilledContractorName(record.contactName, record.companyName)}
        />
      )}
    </CheckInFrame>
  );
}

function CheckInFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-page px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card px-5 py-6 shadow-sm">
        <Image
          src="/brand/tnk-logo-navy.svg"
          alt="TNK Property Services"
          width={407}
          height={126}
          unoptimized
          priority
          className="mb-6 h-14 w-auto max-w-full"
        />
        {children}
      </div>
    </main>
  );
}
