import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResidentForm } from "@/components/resident-form";
import { getResident, listApartmentOptions, requireUser } from "@/lib/data";
import { formatIsoDate, residentName } from "@/lib/residents";
import { canManageResidents } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit resident" };

export default async function EditResidentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) redirect("/residents");
  if (!canManageResidents(user.role)) redirect("/residents");

  const [resident, apartments] = await Promise.all([
    getResident(user.selectedBuildingId, id),
    listApartmentOptions(user.selectedBuildingId),
  ]);
  if (!resident) notFound();

  return (
    <section>
      <Link href={`/residents/apartments/${resident.apartmentId}`} className="text-sm text-brand-blue hover:underline">
        Back to apartment
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Edit {residentName(resident.firstName, resident.lastName)}</h1>
      <ResidentForm
        apartments={apartments}
        returnTo="apartment"
        resident={{
          id: resident.id,
          apartmentId: resident.apartmentId,
          firstName: resident.firstName,
          lastName: resident.lastName,
          type: resident.type,
          phone: resident.phone,
          mobile: resident.mobile,
          secondaryPhone: resident.secondaryPhone,
          email: resident.email,
          moveInOn: resident.moveInOn ? formatIsoDate(resident.moveInOn) : "",
          moveOutOn: resident.moveOutOn ? formatIsoDate(resident.moveOutOn) : "",
          primaryContact: resident.primaryContact,
          notes: resident.notes,
        }}
      />
    </section>
  );
}
