"use client";

import { useTransition } from "react";
import { setWorkOrderStatus } from "@/app/actions/work-orders";
import { WORK_ORDER_STATUSES, formatWorkOrderStatus, type WorkOrderStatus } from "@/lib/work-orders";

export function WorkOrderStatusSelect({
  id,
  number,
  status,
  canCancel,
  returnTo,
}: {
  id: string;
  number: string;
  status: WorkOrderStatus;
  canCancel: boolean;
  returnTo: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Status for ${number}`}
      defaultValue={status}
      disabled={pending}
      className="rounded-md border border-line bg-white px-2 py-1 text-sm"
      onChange={(event) => {
        const data = new FormData();
        data.set("id", id);
        data.set("status", event.target.value);
        data.set("returnTo", returnTo);
        startTransition(() => {
          void setWorkOrderStatus(data);
        });
      }}
    >
      {WORK_ORDER_STATUSES.map((item) =>
        item === "cancelled" && !canCancel && item !== status ? null : (
          <option key={item} value={item}>
            {formatWorkOrderStatus(item)}
          </option>
        ),
      )}
    </select>
  );
}
