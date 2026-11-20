import type { ReactNode } from "react";
import { BuildingBackLink } from "@/components/building-back-link";

export default function ContractorsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BuildingBackLink />
      {children}
    </>
  );
}
