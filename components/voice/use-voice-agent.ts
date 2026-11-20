"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AgentAction, AgentPlan } from "@/lib/types";

type ExecuteResponse = { action?: AgentAction; error?: string };

export function useVoiceAgent() {
  const router = useRouter();
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (transcript: string) => {
    const text = transcript.trim();
    if (!text) return null;
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const response = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = (await response.json()) as { plan?: AgentPlan; error?: string };
      if (!response.ok || !data.plan) {
        throw new Error(data.error ?? "The command could not be planned.");
      }
      setPlan(data.plan);
      return data.plan;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The command failed.";
      setError(message);
      toast.error("Command not completed", { description: message });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const decide = useCallback(
    async (actionId: string, decision: "approve" | "reject") => {
      setBusyStep(actionId);
      setError(null);
      try {
        const response = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId, decision }),
        });
        const data = (await response.json()) as ExecuteResponse;
        if (!response.ok || !data.action) {
          throw new Error(data.error ?? "That action could not run.");
        }
        const updated = data.action;
        setPlan((current) =>
          current
            ? { ...current, steps: current.steps.map((step) => (step.id === updated.id ? updated : step)) }
            : current,
        );
        if (decision === "reject") {
          toast("Action rejected", { description: "Nothing external happened." });
        } else if (updated.status === "failed") {
          toast.error(updated.error ?? "Action failed", {
            description: updated.result?.detail ?? "Check the connection and try again.",
          });
        } else if (updated.result?.simulated) {
          toast("Prepared, not sent", {
            description: updated.result.detail,
          });
        } else {
          toast.success(updated.result?.title ?? "Action completed", {
            description: updated.result?.detail,
          });
        }
        router.refresh();
        return updated;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "That action could not run.";
        setError(message);
        toast.error("Action failed", { description: message });
        return null;
      } finally {
        setBusyStep(null);
      }
    },
    [router],
  );

  const clear = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  return { plan, busy, busyStep, error, run, decide, clear };
}
