import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkOrderForm, type WorkOrderContractorOption } from "@/components/work-order-form";
import { parseCaseNumber } from "@/lib/cases";
import { getWorkOrderCase, listWorkOrderContractors, requireUser } from "@/lib/data";
import { EMAIL_ATTACHMENT_BUDGET } from "@/lib/mail";
import { canSendWorkOrders } from "@/lib/roles";
import { storedFileSize } from "@/lib/storage";
import {
  contactEmail,
  defaultWorkOrderSubject,
  formatFileSize,
  htmlToPlain,
  nextWorkOrderSuffix,
} from "@/lib/work-orders";

export const metadata: Metadata = { title: "Send work order" };

export default async function SendWorkOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const user = await requireUser();
  const number = parseCaseNumber((await params).number);
  if (!canSendWorkOrders(user.role) || !user.selectedBuildingId || number == null) redirect("/cases");

  const record = await getWorkOrderCase(user.selectedBuildingId, number);
  if (!record) notFound();

  const assigned = new Set(record.companies.map((link) => link.companyId));
  const assignedContacts = new Set(record.contacts.map((link) => link.contactId));
  const companies = await listWorkOrderContractors([...assigned]);
  const contractors: WorkOrderContractorOption[] = companies
    .map((company) => ({
      id: company.id,
      name: company.name,
      categoryName: company.category.name,
      pending: company.status !== "approved",
      contacts: company.contacts.flatMap((contact) => {
        const email = contactEmail(contact.email);
        return email ? [{ id: contact.id, name: contact.name, email }] : [];
      }),
    }))
    .sort((a, b) => {
      const rank = (id: string) => (assigned.has(id) ? 0 : 1);
      const byAssigned = rank(a.id) - rank(b.id);
      if (byAssigned !== 0) return byAssigned;
      return a.name.localeCompare(b.name, "en");
    });

  const defaultCompany = contractors.find((contractor) => assigned.has(contractor.id));
  const defaultContact =
    defaultCompany?.contacts.find((contact) => assignedContacts.has(contact.id)) ?? defaultCompany?.contacts[0];
  const suffix = nextWorkOrderSuffix(record.workOrders.map((item) => item.suffix));

  return (
    <section>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/cases" className="text-brand-blue hover:underline">
              Cases
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li>
            <Link href={`/cases/${record.number}`} className="text-brand-blue hover:underline">
              #{record.number}
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li className="text-muted">Work order</li>
        </ol>
      </nav>
      <h1 className="mt-3 font-serif text-3xl">Send work order</h1>
      <p className="mt-2 text-muted">
        Case #{record.number}: {record.subject}
      </p>
      {contractors.length === 0 ? (
        <p className="mt-6 text-muted">Approve a contractor before sending a work order.</p>
      ) : (
        <WorkOrderForm
          caseNumber={record.number}
          contractors={contractors}
          defaultCompanyId={defaultCompany?.id ?? ""}
          defaultContactId={defaultContact?.id ?? ""}
          defaultSubject={defaultWorkOrderSubject(record.number, suffix, record.subject)}
          defaultMessage={htmlToPlain(record.descriptionHtml)}
          defaultPurchaseOrder={record.purchaseOrderNumber ?? ""}
          files={await Promise.all(
            record.files.map(async (file) => {
              const size = await storedFileSize(file.storedName);
              return { id: file.id, name: file.name, kind: file.kind, size, sizeLabel: formatFileSize(size) };
            }),
          )}
          attachmentBudget={EMAIL_ATTACHMENT_BUDGET}
          budgetLabel={formatFileSize(EMAIL_ATTACHMENT_BUDGET)}
        />
      )}
    </section>
  );
}
