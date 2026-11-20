import { parseDateOnly } from "./contractors";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AU_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const AU_DATE_TIME = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})$/;

export const AU_DATE_HINT = "DD/MM/YYYY";
export const AU_DATE_TIME_HINT = "DD/MM/YYYY HH:MM";

export function parseAuDate(value: string): string | null {
  const text = value.trim();
  const iso = ISO_DATE.exec(text);
  if (iso) return dateParts(iso[1], iso[2], iso[3]);
  const au = AU_DATE.exec(text);
  if (au) return dateParts(au[3], au[2], au[1]);
  return null;
}

export function formatAuDate(value: string): string {
  const iso = parseAuDate(value);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function parseAuDateTime(value: string): string | null {
  const text = value.trim();
  const iso = ISO_DATE_TIME.exec(text);
  if (iso) return dateTimeParts(iso[1], iso[2], iso[3], iso[4], iso[5]);
  const au = AU_DATE_TIME.exec(text);
  if (au) return dateTimeParts(au[3], au[2], au[1], au[4], au[5]);
  return null;
}

export function formatAuDateTime(value: string): string {
  const iso = parseAuDateTime(value);
  if (!iso) return "";
  const [date, time] = iso.split("T");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} ${time}`;
}

function dateParts(year: string, month: string, day: string): string | null {
  const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return parseDateOnly(iso) ? iso : null;
}

function dateTimeParts(year: string, month: string, day: string, hour: string, minute: string): string | null {
  const date = dateParts(year, month, day);
  const hours = Number(hour);
  const minutes = Number(minute);
  if (!date || !Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
