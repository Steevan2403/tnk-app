import type { ReactNode } from "react";
import { BuildingSectionCrumb } from "@/components/building-back-link";

export default function BuildingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BuildingSectionCrumb />
      {children}
    </>
  );
}
