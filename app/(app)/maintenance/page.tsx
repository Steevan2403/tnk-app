import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return <ComingSoon title="Maintenance" />;
}
