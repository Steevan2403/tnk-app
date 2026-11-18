import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { approveCompany, deleteCompany, deleteContact, deleteDocument, deleteInsurance } from "@/app/actions/contractors";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ContactForm, DocumentForm, InsuranceForm, NoteForm } from "@/components/contractor-forms";
import { InsuranceBadge } from "@/components/insurance-badge";
import { getContractorCompany, requireUser, type ContractorCompanyDetail } from "@/lib/data";
import {
  formatAbn,
  formatCalendarDate,
  formatDateTime,
  formatIsoDate,
  insuranceStanding,
  isInsuranceExpired,
} from "@/lib/contractors";
import { canManageContractors } from "@/lib/roles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const company = await getContractorCompany(id);
  return { title: company?.name ?? "Company" };
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const company = await getContractorCompany(id);
  if (!company) notFound();

  const canManage = canManageContractors(user.role);
  const editContact = first(query.editContact);
  const editInsurance = first(query.editInsurance);
  const editingContact = company.contacts.find((contact) => contact.id === editContact) ?? null;
  const editingInsurance = company.insurances.find((insurance) => insurance.id === editInsurance) ?? null;
  const standing = insuranceStanding(company.insurances.map((insurance) => insurance.expiresOn));

  return (
    <section>
      <Link href="/contractors" className="text-sm text-brand-blue hover:underline">
        All contractors
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{company.name}</h1>
          <p className="mt-2 text-muted">
            {company.category.name} · {company.status === "pending" ? "Pending approval" : "Approved"}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-3">
            {company.status === "pending" ? (
              <form action={approveCompany}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="returnTo" value="detail" />
                <button
                  type="submit"
                  className="rounded-md bg-brand-green px-3 py-2 text-sm font-medium text-brand-navy"
                >
                  Approve
                </button>
              </form>
            ) : null}
            <Link
              href={`/contractors/${company.id}/edit`}
              className="rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white"
            >
              Edit
            </Link>
            <form action={deleteCompany}>
              <input type="hidden" name="companyId" value={company.id} />
              <ConfirmSubmit
                label="Delete company"
                message="Delete this company, including its contacts, notes, documents, and insurances?"
                className="text-sm text-danger hover:underline"
              />
            </form>
          </div>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 md:p-6">
        <Fact label="ABN" value={company.abn ? formatAbn(company.abn) : null} />
        <Fact label="Address" value={company.address} />
        <Fact label="Phone" value={company.phone} />
        <div>
          <dt className="text-sm text-muted">Email</dt>
          <dd className="mt-1 break-all">
            {company.email ? (
              <a href={`mailto:${company.email}`} className="text-brand-blue hover:underline">
                {company.email}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Website</dt>
          <dd className="mt-1 break-all">
            {company.website ? (
              <a href={company.website} className="text-brand-blue hover:underline" rel="noreferrer">
                {company.website}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Insurance</dt>
          <dd className="mt-1">
            <InsuranceBadge standing={standing} />
          </dd>
        </div>
      </dl>

      <Panel title="Notes">
        {company.notes.length === 0 ? <Empty>No notes yet.</Empty> : null}
        <ul className="mt-4 space-y-3">
          {company.notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-line p-4">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-2 text-sm text-muted">
                {note.author.name} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
        {canManage ? <NoteForm companyId={company.id} /> : null}
      </Panel>

      <Panel title="Contacts">
        {company.contacts.length === 0 ? <Empty>No contacts yet.</Empty> : null}
        <ul className="mt-2 divide-y divide-line">
          {company.contacts.map((contact) => (
            <li key={contact.id} className="py-4">
              {canManage && editingContact?.id === contact.id ? (
                <ContactForm companyId={company.id} contact={contact} />
              ) : (
                <ContactRow company={company} contact={contact} canManage={canManage} />
              )}
            </li>
          ))}
        </ul>
        {canManage && !editingContact ? <ContactForm companyId={company.id} /> : null}
      </Panel>

      <Panel title="Documents">
        {company.documents.length === 0 ? <Empty>No documents yet.</Empty> : null}
        <ul className="mt-2 divide-y divide-line">
          {company.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{document.name}</p>
                <p className="mt-1 text-sm text-muted">{formatDateTime(document.uploadedAt)}</p>
              </div>
              <div className="flex gap-3">
                <a
                  href={`/api/contractor-files/documents/${document.id}`}
                  className="text-sm text-brand-blue hover:underline"
                >
                  Download
                </a>
                {canManage ? (
                  <form action={deleteDocument}>
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {canManage ? <DocumentForm companyId={company.id} /> : null}
      </Panel>

      <Panel title="Insurances">
        {company.insurances.length === 0 ? <Empty>No insurance yet.</Empty> : null}
        <ul className="mt-2 divide-y divide-line">
          {company.insurances.map((insurance) => (
            <li key={insurance.id} className="py-4">
              {canManage && editingInsurance?.id === insurance.id ? (
                <InsuranceForm
                  companyId={company.id}
                  insurance={{
                    id: insurance.id,
                    type: insurance.type,
                    policyNumber: insurance.policyNumber,
                    insurer: insurance.insurer,
                    expiresOn: formatIsoDate(insurance.expiresOn),
                    certificateName: insurance.certificateName,
                  }}
                />
              ) : (
                <InsuranceRow companyId={company.id} insurance={insurance} canManage={canManage} />
              )}
            </li>
          ))}
        </ul>
        {canManage && !editingInsurance ? <InsuranceForm companyId={company.id} /> : null}
      </Panel>
    </section>
  );
}

function ContactRow({
  company,
  contact,
  canManage,
}: {
  company: ContractorCompanyDetail;
  contact: ContractorCompanyDetail["contacts"][number];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-medium">{contact.name}</p>
        {contact.title ? <p className="text-sm text-muted">{contact.title}</p> : null}
        <p className="mt-1 text-sm">
          {blank(contact.phone)} · {blank(contact.mobile)}
        </p>
        <p className="text-sm break-all">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="text-brand-blue hover:underline">
              {contact.email}
            </a>
          ) : (
            "—"
          )}
        </p>
      </div>
      {canManage ? (
        <div className="flex gap-3">
          <Link
            href={`/contractors/${company.id}?editContact=${contact.id}`}
            className="text-sm text-brand-blue hover:underline"
          >
            Edit
          </Link>
          <form action={deleteContact}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="contactId" value={contact.id} />
            <button type="submit" aria-label={`Remove ${contact.name}`} className="text-sm text-danger hover:underline">
              Remove
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function InsuranceRow({
  companyId,
  insurance,
  canManage,
}: {
  companyId: string;
  insurance: ContractorCompanyDetail["insurances"][number];
  canManage: boolean;
}) {
  const expired = isInsuranceExpired(insurance.expiresOn);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-medium">{insurance.type}</p>
        <p className="mt-1 text-sm text-muted">
          {blank(insurance.insurer)} · {blank(insurance.policyNumber)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <time dateTime={formatIsoDate(insurance.expiresOn)} className={expired ? "font-medium text-danger" : undefined}>
            {formatCalendarDate(insurance.expiresOn)}
          </time>
          {expired ? <InsuranceBadge standing="expired" /> : null}
        </p>
        {insurance.certificateStoredName ? (
          <a
            href={`/api/contractor-files/certificates/${insurance.id}`}
            className="mt-2 inline-block text-sm text-brand-blue hover:underline"
          >
            Download certificate
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted">No certificate</p>
        )}
      </div>
      {canManage ? (
        <div className="flex gap-3">
          <Link
            href={`/contractors/${companyId}?editInsurance=${insurance.id}`}
            className="text-sm text-brand-blue hover:underline"
          >
            Edit
          </Link>
          <form action={deleteInsurance}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="insuranceId" value={insurance.id} />
            <button
              type="submit"
              aria-label={`Remove ${insurance.type}`}
              className="text-sm text-danger hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-xl border border-line bg-card p-4 md:p-6">
      <h2 className="font-serif text-2xl text-brand-navy">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">{blank(value)}</dd>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="mt-4 text-muted">{children}</p>;
}

function blank(value: string | null): string {
  return value && value.trim() ? value : "—";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
