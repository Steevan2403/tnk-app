import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteKey } from "@/app/actions/keys";
import {
  deleteAgent,
  deleteApartment,
  deleteApartmentDocument,
  deleteApartmentImage,
  deleteOwner,
  deleteResident,
  deleteVehicle,
  setOccupancy,
} from "@/app/actions/residents";
import { ImageThumb } from "@/components/image-thumb";
import {
  AgentForm,
  ApartmentDocumentForm,
  ApartmentImageForm,
  ApartmentNoteForm,
  OwnerForm,
  VehicleForm,
} from "@/components/apartment-forms";
import { ApartmentDialog } from "@/components/apartment-dialog";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { KeyDialog } from "@/components/key-dialog";
import { PriorityBadge } from "@/components/priority-badge";
import { EmptyState, Panel } from "@/components/ui";
import { getApartment, listApartmentCases, listApartmentOptions, requireUser, type ApartmentDetail } from "@/lib/data";
import { formatStatus } from "@/lib/cases";
import { formatKeyType, keyApartmentAccess, sortKeys } from "@/lib/keys";
import {
  compareLabel,
  formatCalendarDate,
  formatLotNumber,
  formatDateTime,
  formatIsoDate,
  formatOccupancy,
  formatResidentType,
  isExpiredDate,
  parseApartmentTab,
  residentName,
  type ApartmentTab,
} from "@/lib/residents";
import { canManageResidents } from "@/lib/roles";

const TABS: { id: ApartmentTab; label: string }[] = [
  { id: "residents", label: "Residents" },
  { id: "vehicles", label: "Vehicles" },
  { id: "keys", label: "Keys" },
  { id: "documents", label: "Documents" },
  { id: "images", label: "Images" },
  { id: "requests", label: "Requests" },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  if (!user.selectedBuildingId) return { title: "Apartment" };
  const apartment = await getApartment(user.selectedBuildingId, (await params).id);
  return { title: apartment?.number ?? "Apartment" };
}

export default async function ApartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  if (!user.selectedBuildingId) notFound();

  const [apartment, options] = await Promise.all([
    getApartment(user.selectedBuildingId, id),
    listApartmentOptions(user.selectedBuildingId),
  ]);
  if (!apartment) notFound();
  const keyAccess = keyApartmentAccess(
    {
      role: user.role,
      selectedBuildingId: user.selectedBuildingId,
      memberBuildingIds: user.buildingIds,
    },
    { id: apartment.id, buildingId: apartment.buildingId },
  );
  if (!keyAccess.ok) notFound();

  const canManage = canManageResidents(user.role);
  const tab = parseApartmentTab(first(query.tab));
  const requests = tab === "requests" ? await listApartmentCases(user.selectedBuildingId, apartment.id) : [];
  const ordered = [...options].sort((a, b) => compareLabel(a.number, b.number));
  const index = ordered.findIndex((item) => item.id === apartment.id);
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const editVehicle = first(query.editVehicle);
  const editOwner = first(query.editOwner);
  const editAgent = first(query.editAgent) === "1";
  const editingVehicle = apartment.vehicles.find((vehicle) => vehicle.id === editVehicle) ?? null;
  const keyQuery = first(query.key);
  const addingKey = keyQuery === "new";
  const editingKey = apartment.keys.find((key) => key.id === keyQuery) ?? null;
  const editingOwner = apartment.owners.find((owner) => owner.id === editOwner) ?? null;
  const nextOccupancy = apartment.occupancy === "investment" ? "owner_occupied" : "investment";

  return (
    <section>
      <Link href="/residents?tab=apartments" className="text-sm text-brand-blue hover:underline">
        All apartments
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{apartment.number}</h1>
          <p className="mt-2 text-muted">Lot {formatLotNumber(apartment.lotNumber)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-3 text-sm">
            {previous ? (
              <Link href={`/residents/apartments/${previous.id}`} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {next ? (
              <Link href={`/residents/apartments/${next.id}`} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
          {canManage ? (
            <>
              <ApartmentDialog
                apartment={{ id: apartment.id, number: apartment.number, lotNumber: apartment.lotNumber }}
              />
              <form action={deleteApartment}>
                <input type="hidden" name="apartmentId" value={apartment.id} />
                <ConfirmSubmit
                  label="Delete apartment"
                  message="Delete this apartment, including its residents, vehicles, keys, documents, and images?"
                  className="text-sm text-danger hover:underline"
                />
              </form>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">{formatOccupancy(apartment.occupancy)}</p>
        {canManage ? (
          <form action={setOccupancy}>
            <input type="hidden" name="apartmentId" value={apartment.id} />
            <input type="hidden" name="occupancy" value={nextOccupancy} />
            <button type="submit" className="text-sm text-brand-blue hover:underline">
              {apartment.occupancy === "investment" ? "Mark owner-occupied" : "Mark as investment"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <nav aria-label="Apartment sections" className="flex flex-wrap gap-x-1 border-b border-line">
            {TABS.map((item) => {
              const active = item.id === tab;
              return (
                <Link
                  key={item.id}
                  href={tabHref(apartment.id, item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    active
                      ? "border-brand-navy text-brand-navy"
                      : "border-transparent text-muted hover:text-brand-blue"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {tab === "residents" ? (
            <ResidentTab apartment={apartment} canManage={canManage} />
          ) : null}
          {tab === "vehicles" ? (
            <VehicleTab apartment={apartment} canManage={canManage} editing={editingVehicle} />
          ) : null}
          {tab === "keys" ? (
            <KeysTab apartment={apartment} canManage={canManage} adding={addingKey} editing={editingKey} />
          ) : null}
          {tab === "documents" ? <DocumentTab apartment={apartment} canManage={canManage} /> : null}
          {tab === "images" ? <ImageTab apartment={apartment} canManage={canManage} /> : null}
          {tab === "requests" ? <RequestsTab cases={requests} /> : null}
        </div>

        <aside className="space-y-6">
          <Panel title="Notes">
            {apartment.notes.length === 0 ? <Empty>No notes yet.</Empty> : null}
            <ul className="mt-4 space-y-3">
              {apartment.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-line p-4">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-2 text-sm text-muted">
                    {note.author.name} · {formatDateTime(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
            <ApartmentNoteForm apartmentId={apartment.id} tab={tab} />
          </Panel>

          {apartment.occupancy === "investment" ? (
            <>
              <Panel title="Owners">
                {apartment.owners.length === 0 ? <Empty>No owners yet.</Empty> : null}
                <ul className="mt-2 divide-y divide-line">
                  {apartment.owners.map((owner) => (
                    <li key={owner.id} className="py-4">
                      {canManage && editingOwner?.id === owner.id ? (
                        <OwnerForm apartmentId={apartment.id} owner={owner} />
                      ) : (
                        <OwnerRow apartmentId={apartment.id} owner={owner} canManage={canManage} />
                      )}
                    </li>
                  ))}
                </ul>
                {canManage && !editingOwner ? <OwnerForm apartmentId={apartment.id} /> : null}
              </Panel>
              <Panel title="Managing agent">
                {apartment.agent && !(canManage && editAgent) ? (
                  <AgentRow apartmentId={apartment.id} agent={apartment.agent} canManage={canManage} />
                ) : canManage ? (
                  <AgentForm apartmentId={apartment.id} agent={apartment.agent ?? undefined} />
                ) : (
                  <Empty>No managing agent.</Empty>
                )}
              </Panel>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function ResidentTab({ apartment, canManage }: { apartment: ApartmentDetail; canManage: boolean }) {
  return (
    <div className="mt-4">
      {canManage ? (
        <Link
          href={`/residents/new?apartment=${apartment.id}`}
          className="text-sm font-medium text-brand-blue hover:underline"
        >
          Add resident
        </Link>
      ) : null}
      {apartment.residents.length === 0 ? <Empty>No residents yet.</Empty> : null}
      <ul className="mt-2 divide-y divide-line">
        {apartment.residents.map((resident) => (
          <li key={resident.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div>
              <p className="font-medium">
                {residentName(resident.firstName, resident.lastName)}
                {resident.primaryContact ? (
                  <span title="Primary contact" aria-label="Primary contact" className="ml-2 text-brand-navy">
                    ★
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted">{formatResidentType(resident.type)}</p>
              <p className="mt-1 text-sm">{blank(resident.mobile)}</p>
              <p className="text-sm break-all">
                {resident.email ? (
                  <a href={`mailto:${resident.email}`} className="text-brand-blue hover:underline">
                    {resident.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </div>
            {canManage ? (
              <div className="flex gap-3">
                <Link href={`/residents/${resident.id}/edit`} className="text-sm text-brand-blue hover:underline">
                  Edit
                </Link>
                <form action={deleteResident}>
                  <input type="hidden" name="apartmentId" value={apartment.id} />
                  <input type="hidden" name="residentId" value={resident.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${residentName(resident.firstName, resident.lastName)}`}
                    className="text-sm text-danger hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VehicleTab({
  apartment,
  canManage,
  editing,
}: {
  apartment: ApartmentDetail;
  canManage: boolean;
  editing: ApartmentDetail["vehicles"][number] | null;
}) {
  return (
    <div className="mt-2">
      {apartment.vehicles.length === 0 ? <Empty>No vehicles yet.</Empty> : null}
      <ul className="divide-y divide-line">
        {apartment.vehicles.map((vehicle) => (
          <li key={vehicle.id} className="py-4">
            {canManage && editing?.id === vehicle.id ? (
              <VehicleForm apartmentId={apartment.id} vehicle={vehicle} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{vehicle.registration}</p>
                  <p className="mt-1 text-sm text-muted">
                    {[vehicle.make, vehicle.model, vehicle.colour].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-sm">
                    Car space {blank(vehicle.carSpace)} · {blank(vehicle.location)}
                  </p>
                  {vehicle.photoStoredName ? (
                    <a
                      href={`/api/resident-files/vehicles/${vehicle.id}`}
                      className="mt-2 inline-block text-sm text-brand-blue hover:underline"
                    >
                      View photo
                    </a>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex gap-3">
                    <Link
                      href={`/residents/apartments/${apartment.id}?tab=vehicles&editVehicle=${vehicle.id}`}
                      className="text-sm text-brand-blue hover:underline"
                    >
                      Edit
                    </Link>
                    <form action={deleteVehicle}>
                      <input type="hidden" name="apartmentId" value={apartment.id} />
                      <input type="hidden" name="vehicleId" value={vehicle.id} />
                      <button
                        type="submit"
                        aria-label={`Remove ${vehicle.registration}`}
                        className="text-sm text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && !editing ? <VehicleForm apartmentId={apartment.id} /> : null}
    </div>
  );
}

function KeysTab({
  apartment,
  canManage,
  adding,
  editing,
}: {
  apartment: ApartmentDetail;
  canManage: boolean;
  adding: boolean;
  editing: ApartmentDetail["keys"][number] | null;
}) {
  const keys = sortKeys(apartment.keys);
  return (
    <div className="mt-4">
      {canManage ? (
        <Link href={keyHref(apartment.id, "new")} className="text-sm font-medium text-brand-blue hover:underline">
          Add key
        </Link>
      ) : null}
      {keys.length === 0 ? <Empty>No keys yet.</Empty> : null}
      <ul aria-label="Keys" className="mt-2 divide-y divide-line">
        {keys.map((key) => (
          <li key={key.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div>
              <p className="font-medium">{key.number}</p>
              <p className="mt-1 text-sm text-muted">{formatKeyType(key.type)}</p>
              <p className="mt-1 text-sm">{key.location?.trim() ? key.location : "No location recorded"}</p>
              {key.comment ? <p className="mt-1 whitespace-pre-wrap text-sm">{key.comment}</p> : null}
            </div>
            {canManage ? (
              <div className="flex gap-3">
                <Link
                  href={keyHref(apartment.id, key.id)}
                  aria-label={`Edit key ${key.number}`}
                  className="text-sm text-brand-blue hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteKey}>
                  <input type="hidden" name="apartmentId" value={apartment.id} />
                  <input type="hidden" name="keyId" value={key.id} />
                  <ConfirmSubmit
                    label="Remove"
                    ariaLabel={`Remove key ${key.number}`}
                    message={`Remove key ${key.number}?`}
                    className="text-sm text-danger hover:underline"
                  />
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage && adding ? <KeyDialog apartmentId={apartment.id} /> : null}
      {canManage && editing ? (
        <KeyDialog
          apartmentId={apartment.id}
          keyRecord={{
            id: editing.id,
            number: editing.number,
            type: editing.type,
            location: editing.location,
            comment: editing.comment,
          }}
        />
      ) : null}
    </div>
  );
}

function DocumentTab({ apartment, canManage }: { apartment: ApartmentDetail; canManage: boolean }) {
  return (
    <div className="mt-2">
      {apartment.documents.length === 0 ? <Empty>No documents yet.</Empty> : null}
      <ul className="divide-y divide-line">
        {apartment.documents.map((document) => {
          const expired = document.expiresOn ? isExpiredDate(document.expiresOn) : false;
          return (
            <li key={document.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{document.name}</p>
                <p className="mt-1 text-sm text-muted">Uploaded {formatDateTime(document.uploadedAt)}</p>
                {document.expiresOn ? (
                  <p className="mt-1 text-sm">
                    <time
                      dateTime={formatIsoDate(document.expiresOn)}
                      className={expired ? "font-medium text-danger" : undefined}
                    >
                      {formatCalendarDate(document.expiresOn)}
                    </time>
                    {expired ? <span className="ml-2 font-medium text-danger">Expired</span> : null}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-3">
                <a
                  href={`/api/resident-files/documents/${document.id}`}
                  className="text-sm text-brand-blue hover:underline"
                >
                  Download
                </a>
                {canManage ? (
                  <form action={deleteApartmentDocument}>
                    <input type="hidden" name="apartmentId" value={apartment.id} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canManage ? <ApartmentDocumentForm apartmentId={apartment.id} /> : null}
    </div>
  );
}

function ImageTab({ apartment, canManage }: { apartment: ApartmentDetail; canManage: boolean }) {
  return (
    <div className="mt-4">
      {apartment.images.length === 0 ? <Empty>No images yet.</Empty> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {apartment.images.map((image) => (
          <li key={image.id} className="rounded-lg border border-line p-2">
            <ImageThumb name={image.name} src={`/api/resident-files/images/${image.id}`} />
            <p className="mt-2 truncate text-sm">{image.name}</p>
            {canManage ? (
              <form action={deleteApartmentImage} className="mt-1">
                <input type="hidden" name="apartmentId" value={apartment.id} />
                <input type="hidden" name="imageId" value={image.id} />
                <button type="submit" aria-label={`Remove ${image.name}`} className="text-sm text-danger hover:underline">
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? <ApartmentImageForm apartmentId={apartment.id} /> : null}
    </div>
  );
}

function OwnerRow({
  apartmentId,
  owner,
  canManage,
}: {
  apartmentId: string;
  owner: ApartmentDetail["owners"][number];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-medium">{owner.name}</p>
        <p className="mt-1 text-sm">
          {blank(owner.phone)} · {blank(owner.mobile)}
        </p>
        <p className="text-sm break-all">{blank(owner.email)}</p>
        <p className="mt-1 text-sm">{blank(owner.postalAddress)}</p>
        <p className="mt-1 text-sm text-muted">
          Strata committee member: {owner.strataCommittee ? "Yes" : "No"}
        </p>
      </div>
      {canManage ? (
        <div className="flex gap-3">
          <Link
            href={`/residents/apartments/${apartmentId}?editOwner=${owner.id}`}
            className="text-sm text-brand-blue hover:underline"
          >
            Edit
          </Link>
          <form action={deleteOwner}>
            <input type="hidden" name="apartmentId" value={apartmentId} />
            <input type="hidden" name="ownerId" value={owner.id} />
            <button type="submit" aria-label={`Remove ${owner.name}`} className="text-sm text-danger hover:underline">
              Remove
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AgentRow({
  apartmentId,
  agent,
  canManage,
}: {
  apartmentId: string;
  agent: NonNullable<ApartmentDetail["agent"]>;
  canManage: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="font-medium">{agent.company}</p>
      <p className="mt-1 text-sm">{blank(agent.contactName)}</p>
      <p className="mt-1 text-sm">{blank(agent.phone)}</p>
      <p className="text-sm break-all">{blank(agent.email)}</p>
      <p className="mt-1 text-sm">{blank(agent.address)}</p>
      {canManage ? (
        <div className="mt-3 flex gap-3">
          <Link href={`/residents/apartments/${apartmentId}?editAgent=1`} className="text-sm text-brand-blue hover:underline">
            Edit
          </Link>
          <form action={deleteAgent}>
            <input type="hidden" name="apartmentId" value={apartmentId} />
            <button type="submit" className="text-sm text-danger hover:underline">
              Remove
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <EmptyState>{children}</EmptyState>;
}

function RequestsTab({
  cases,
}: {
  cases: { number: number; subject: string; status: string; priority: string; startDate: Date }[];
}) {
  if (cases.length === 0) return <Empty>No requests yet.</Empty>;
  return (
    <ul className="mt-4 divide-y divide-line">
      {cases.map((item) => (
        <li key={item.number} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <Link href={`/cases/${item.number}`} className="font-medium text-brand-blue hover:underline">
              #{item.number} {item.subject}
            </Link>
            <p className="text-sm text-muted">{formatCalendarDate(item.startDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={item.priority} />
            <span className="text-sm">{formatStatus(item.status)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function tabHref(id: string, tab: ApartmentTab): string {
  if (tab === "residents") return `/residents/apartments/${id}`;
  return `/residents/apartments/${id}?tab=${tab}`;
}

function keyHref(apartmentId: string, key: string): string {
  return `/residents/apartments/${apartmentId}?tab=keys&key=${key}`;
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function blank(value: string | null): string {
  return value && value.trim() ? value : "—";
}
