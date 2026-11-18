import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <p className="mt-3 text-muted">That page is not part of this app.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-pine hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
