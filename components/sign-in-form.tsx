"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/actions/auth";

const initial: SignInState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-pine px-4 py-2.5 font-medium text-white hover:bg-pine/90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
