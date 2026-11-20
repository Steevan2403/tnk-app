import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TNK Building Manager",
    template: "%s · TNK Building Manager",
  },
  description: "Building management for TNK Property Services.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className="h-full">
      <body className="min-h-dvh bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
