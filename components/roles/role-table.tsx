"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import type { Role } from "@/lib/types";
import { cn, languageLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const filters = ["All", "Open", "Draft", "Paused"] as const;

function statusTone(status: Role["status"]) {
  if (status === "open") return "verified";
  if (status === "draft") return "neutral";
  if (status === "paused") return "flag";
  return "neutral";
}

export function RoleTable({ roles }: { roles: Role[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return roles.filter((role) => {
      const statusMatch = filter === "All" || role.status === filter.toLowerCase();
      const queryMatch =
        !query.trim() ||
        role.title.toLowerCase().includes(query.toLowerCase()) ||
        role.playbookName.toLowerCase().includes(query.toLowerCase());
      return statusMatch && queryMatch;
    });
  }, [roles, filter, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-1">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-[4px] px-2 py-1 text-[10.5px] font-medium transition",
                filter === item ? "bg-ink text-chalk" : "text-slate hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-[190px] items-center rounded-[5px] border border-rule bg-white px-2">
            <Search className="h-3 w-3 text-slate/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter roles…"
              className="h-full w-full bg-transparent px-1.5 text-[10.5px] text-ink outline-none placeholder:text-slate/60"
              aria-label="Filter roles"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule bg-chalk/50 text-[9.5px] font-medium text-slate">
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Languages</th>
              <th className="px-3 py-2 font-medium">Playbook</th>
              <th className="px-3 py-2 font-medium">Pipeline</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((role) => (
              <tr key={role.id} className="group border-b border-rule/70 transition-colors last:border-b-0 hover:bg-white">
                <td className="px-4 py-3">
                  <Link href={`/app/roles/${role.id}`} className="block">
                    <span className="block text-[12.5px] font-medium text-ink">{role.title}</span>
                    <span className="mt-0.5 block text-[10px] text-slate">
                      {role.location} · updated {new Date(role.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {role.languages.map((language) => (
                      <span key={language} className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 text-[9px] text-slate">
                        {languageLabel(language)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="block text-[10.5px] text-ink">{role.playbookName}</span>
                  <span className="mt-0.5 block font-mono text-[9px] text-slate">v{role.playbookVersion}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-1.5 w-[92px] overflow-hidden rounded-full bg-rule/60">
                      <span className="h-full bg-ink/20" style={{ width: `${(role.interviewed / Math.max(role.invited, 1)) * 100}%` }} />
                      <span className="h-full bg-flag" style={{ width: `${(role.inReview / Math.max(role.invited, 1)) * 100}%` }} />
                      <span className="h-full bg-ultramarine" style={{ width: `${(role.shortlisted / Math.max(role.invited, 1)) * 100}%` }} />
                      <span className="h-full bg-verified" style={{ width: `${(role.scheduled / Math.max(role.invited, 1)) * 100}%` }} />
                    </div>
                    <span className="font-mono text-[9.5px] tabular text-slate">
                      {role.invited} → {role.scheduled}
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-slate">{role.inReview} in review · {role.shortlisted} shortlisted</p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTone(role.status)} dot>
                    {role.status[0].toUpperCase() + role.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" asChild className="text-slate group-hover:text-ink">
                    <Link href={`/app/roles/${role.id}`}>
                      Open
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-[11.5px] text-slate">No roles match this filter.</p>
        ) : null}
      </div>
    </div>
  );
}
