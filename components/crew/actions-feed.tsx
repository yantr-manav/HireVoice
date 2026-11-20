"use client";

import Link from "next/link";
import type { AgentAction } from "@/lib/types";
import { AudioLines, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { PlanStep } from "@/components/voice/plan-view";
import { useVoiceAgent } from "@/components/voice/use-voice-agent";

export function ActionsFeed({ actions }: { actions: AgentAction[] }) {
  const { decide, busyStep } = useVoiceAgent();
  const pending = actions.filter((action) => action.mutating && action.status === "proposed");
  const ordered = [...pending, ...actions.filter((action) => !pending.includes(action))];

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Agent actions"
          meta={`${actions.length} recent · ${pending.length} waiting`}
          action={
            <Link href="/app/voice">
              <Button variant="ghost" size="sm">
                <AudioLines className="h-3 w-3" />
                Voice desk
              </Button>
            </Link>
          }
        />
        {ordered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Check className="mx-auto h-5 w-5 text-verified" />
            <p className="mt-2 text-[11.5px] text-slate">No agent actions yet.</p>
            <p className="mt-1 text-[10px] text-slate/70">
              Voice commands, mail sends and scheduled interviews appear here with their approval state.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {ordered.map((action) => (
              <PlanStep
                key={action.id}
                action={action}
                busy={busyStep === action.id}
                onDecide={decide}
              />
            ))}
          </ul>
        )}
      </Panel>

      <div className="space-y-3">
        <Panel className="p-4">
          <h2 className="text-[11.5px] font-semibold text-ink">How the gate works</h2>
          <ol className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate">
            <li>
              <span className="font-medium text-ink">1. Plan.</span> A command becomes a small list of tool
              calls. Nothing runs yet.
            </li>
            <li>
              <span className="font-medium text-ink">2. Read.</span> Read-only steps run immediately and show
              their source.
            </li>
            <li>
              <span className="font-medium text-ink">3. Approve.</span> Writes wait for one explicit
              approval, then run once.
            </li>
            <li>
              <span className="font-medium text-ink">4. Record.</span> Every step is stored with actor,
              result and time.
            </li>
          </ol>
        </Panel>
        <div className="rounded-[10px] border border-ink/10 bg-ink p-4 text-chalk">
          <p className="text-[10px] uppercase tracking-[0.08em] text-mist/45">Never automatic</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-mist/80">
            No action can reject a candidate, send a rejection email, or retry a failed external call
            without a recruiter.
          </p>
        </div>
      </div>
    </div>
  );
}
