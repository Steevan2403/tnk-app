import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Mark } from "@/components/mark";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card px-6 py-8 shadow-sm sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Mark className="h-10 w-10 text-ink" />
          <div>
            <p className="font-serif text-2xl leading-none">TNK</p>
            <p className="text-sm text-muted">Property Services</p>
          </div>
        </div>
        <h1 className="font-serif text-3xl">Sign in</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Sign in to manage the buildings on your account.
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
