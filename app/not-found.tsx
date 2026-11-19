import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6 py-24">
      <div className="w-full rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-3xl">Page not found</h1>
        <p className="mt-3 text-muted">That page is not part of this app.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-brand-blue hover:underline">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
