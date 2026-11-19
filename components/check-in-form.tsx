"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { recordSiteVisit, type CheckInFormState } from "@/app/actions/check-in";
import type { SiteAction } from "@/lib/check-in";

const controlClass =
  "w-full rounded-md border border-line bg-white px-3 py-3 text-base text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40";

export function CheckInForm({
  token,
  action,
  defaultName,
}: {
  token: string;
  action: SiteAction;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState(recordSiteVisit, {} as CheckInFormState);
  const [locating, setLocating] = useState(false);
  const busy = pending || locating;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLocating(true);
    const location = await readOptionalLocation();
    if (location) {
      data.set("latitude", String(location.latitude));
      data.set("longitude", String(location.longitude));
    }
    startTransition(() => {
      setLocating(false);
      formAction(data);
    });
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="action" value={action} />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {action === "check_in" ? (
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Your name
          </label>
          <input id="name" name="name" defaultValue={defaultName} required maxLength={120} autoComplete="name" className={controlClass} />
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-blue disabled:opacity-60"
      >
        {busy ? "Saving…" : action === "check_in" ? "Check in" : "Check out"}
      </button>
      <p className="text-sm text-muted">
        If you allow it, this phone can share its location with the site team. You can continue without sharing location.
      </p>
    </form>
  );
}

function readOptionalLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 3500 },
    );
  });
}
