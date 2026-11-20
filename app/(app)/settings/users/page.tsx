import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveUserBuildings } from "@/app/actions/buildings";
import { listBuildings, listManagedUsers, requireUser } from "@/lib/data";
import { canAssignBuildings, formatRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!canAssignBuildings(user.role)) notFound();

  const [people, buildings] = await Promise.all([listManagedUsers(), listBuildings()]);

  return (
    <section>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/settings" className="text-brand-blue hover:underline">
              Settings
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li className="text-muted">Users</li>
        </ol>
      </nav>
      <h1 className="mt-3 font-serif text-3xl">Users</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Choose the buildings each manager and staff member can open. Admins can open every building.
      </p>
      {people.length === 0 ? (
        <p className="mt-6 text-muted">No managers or staff yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {people.map((person) => (
            <form key={person.id} action={saveUserBuildings} className="max-w-xl rounded-xl border border-line bg-card p-4">
              <input type="hidden" name="userId" value={person.id} />
              <h2 className="text-lg font-medium">{person.name}</h2>
              <p className="text-sm text-muted">
                {formatRole(person.role)} · {person.email}
              </p>
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium">Buildings</legend>
                {buildings.length === 0 ? <p className="text-sm text-muted">No buildings yet.</p> : null}
                {buildings.map((building) => (
                  <label key={building.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="buildingId"
                      value={building.id}
                      defaultChecked={person.buildingIds.includes(building.id)}
                      className="size-4 accent-brand-navy"
                    />
                    {building.name}
                  </label>
                ))}
              </fieldset>
              <button
                type="submit"
                className="mt-4 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
              >
                Save buildings
              </button>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
