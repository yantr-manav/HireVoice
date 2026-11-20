import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function scoreTone(value: number) {
  if (value >= 4) return "text-verified";
  if (value >= 3) return "text-flag";
  return "text-onair";
}

export function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    invited: "Invited",
    interviewed: "Interviewed",
    in_review: "In review",
    shortlisted: "Shortlisted",
    scheduled: "Scheduled",
    closed: "Closed",
  };
  return labels[stage] ?? stage;
}

export function languageLabel(language: string) {
  const labels: Record<string, string> = {
    en: "English",
    hi: "हिंदी",
    hinglish: "Hinglish",
    mr: "मराठी",
  };
  return labels[language] ?? language;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function seededPeaks(seed: number, count = 132) {
  let value = seed;
  const peaks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const noise = value / 4294967296;
    const envelope =
      0.28 +
      0.4 * Math.abs(Math.sin((i / count) * Math.PI * 4.2 + seed * 0.03)) +
      0.22 * Math.sin((i / count) * Math.PI * 11 + seed);
    peaks.push(clamp(0.08 + noise * 0.45 + envelope * 0.55, 0.06, 1));
  }
  return peaks;
}

export function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.resolve();
}
