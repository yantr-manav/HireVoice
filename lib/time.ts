export const IST_OFFSET_MS = 330 * 60 * 1000;

export type IstParts = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 Sunday
  key: string; // YYYY-MM-DD in IST
};

export function istParts(input: Date | string): IstParts {
  const date = typeof input === "string" ? new Date(input) : input;
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    key,
  };
}

export function istDateKey(input: Date | string): string {
  return istParts(input).key;
}

/** UTC instant for a wall-clock time in IST. */
export function istInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MS);
}

export function istAt(dayKey: string, hour = 0, minute = 0): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return istInstant(year, month - 1, day, hour, minute);
}

export function addDays(input: Date, days: number): Date {
  return new Date(input.getTime() + days * 86_400_000);
}

export function startOfIstDay(input: Date | string): Date {
  const parts = istParts(input);
  return istInstant(parts.year, parts.month, parts.day, 0, 0);
}

export function endOfIstDay(input: Date | string): Date {
  return new Date(startOfIstDay(input).getTime() + 86_400_000 - 1);
}

export function startOfIstWeek(input: Date): Date {
  const parts = istParts(input);
  const mondayOffset = (parts.weekday + 6) % 7;
  return addDays(startOfIstDay(input), -mondayOffset);
}

export function monthGridStart(input: Date): Date {
  const parts = istParts(input);
  const first = istInstant(parts.year, parts.month, 1);
  const firstParts = istParts(first);
  const mondayOffset = (firstParts.weekday + 6) % 7;
  return addDays(startOfIstDay(first), -mondayOffset);
}

export function istLabel(input: Date | string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(
    typeof input === "string" ? new Date(input) : input,
  );
}

export function formatIstTime(input: Date | string): string {
  return istLabel(input, { hour: "2-digit", minute: "2-digit", hour12: false }).replace("24:", "00:");
}

export function formatIstDay(input: Date | string): string {
  return istLabel(input, { weekday: "short", day: "numeric", month: "short" });
}

export function formatIstDate(input: Date | string): string {
  return istLabel(input, { weekday: "long", day: "numeric", month: "long" });
}

export function formatIstRange(start: Date | string, end: Date | string): string {
  return `${formatIstDay(start)} · ${formatIstTime(start)}–${formatIstTime(end)} IST`;
}

export function relativeToNow(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 1) return "now";
  if (Math.abs(minutes) < 60) return minutes > 0 ? `in ${minutes} min` : `${-minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `in ${hours} hr` : `${-hours} hr ago`;
  const days = Math.round(hours / 24);
  return days > 0 ? `in ${days} d` : `${-days} d ago`;
}

export function monthName(month: number): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(Date.UTC(2026, month, 1)));
}
