import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,#e7eefc,#f4f6fb_58%)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card px-6 py-8 shadow-[0_24px_60px_rgb(0_0_128/0.1)] sm:px-8">
        <Image
          src="/brand/tnk-logo-navy.svg"
          alt="TNK Property Services"
          width={407}
          height={126}
          unoptimized
          priority
          className="mb-8 h-16 w-auto max-w-full"
        />
        <h1 className="font-serif text-3xl">Sign in</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Sign in to manage the buildings on your account.
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
