import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Contractors" };

export default function ContractorsPage() {
  return <ComingSoon title="Contractors" />;
}
