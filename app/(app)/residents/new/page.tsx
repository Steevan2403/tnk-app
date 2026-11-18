import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResidentForm } from "@/components/resident-form";
import { listApartmentOptions, requireUser } from "@/lib/data";
import { canManageResidents } from "@/lib/roles";

export const metadata: Metadata = { title: "New resident" };

export default async function NewResidentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canManageResidents(user.role)) redirect("/residents");
  if (!user.selectedBuildingId) redirect("/residents");

  const apartments = await listApartmentOptions(user.selectedBuildingId);
  const params = await searchParams;
  const requested = first(params.apartment);
  const apartmentId = apartments.some((apartment) => apartment.id === requested) ? requested : "";

  return (
    <section>
      <Link href={apartmentId ? `/residents/apartments/${apartmentId}` : "/residents"} className="text-sm text-brand-blue hover:underline">
        {apartmentId ? "Back to apartment" : "All residents"}
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New resident</h1>
      {apartments.length === 0 ? (
        <p className="mt-6 text-muted">Add an apartment before adding a resident.</p>
      ) : (
        <ResidentForm apartments={apartments} apartmentId={apartmentId} returnTo={apartmentId ? "apartment" : ""} />
      )}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
