import { candidates } from "@/lib/demo/data";

export function candidateIdForEmail(email: string | undefined | null): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  return candidates.find((candidate) => candidate.email.toLowerCase() === normalized)?.id;
}

export function candidateNameForEmail(email: string | undefined | null): string | undefined {
  const id = candidateIdForEmail(email);
  return candidates.find((candidate) => candidate.id === id)?.name;
}
