import { headers } from "next/headers";
import { toDataURL } from "qrcode";

export async function assetDetailUrl(id: string): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost";
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}/building/assets/${id}`;
}

export async function assetQrDataUrl(id: string): Promise<string> {
  return toDataURL(await assetDetailUrl(id), { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
