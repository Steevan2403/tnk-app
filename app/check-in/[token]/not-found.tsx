import Image from "next/image";
import { INVALID_CHECK_IN_LINK } from "@/lib/check-in";

export default function CheckInNotFound() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#e7eefc,#f4f6fb_58%)] px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card px-5 py-6 shadow-[0_24px_60px_rgb(0_0_128/0.1)]">
        <Image
          src="/brand/tnk-logo-navy.svg"
          alt="TNK Property Services"
          width={407}
          height={126}
          unoptimized
          priority
          className="mb-6 h-14 w-auto max-w-full"
        />
        <h1 className="font-serif text-3xl">Check-in link</h1>
        <p className="mt-3 text-muted">{INVALID_CHECK_IN_LINK}</p>
      </div>
    </main>
  );
}
