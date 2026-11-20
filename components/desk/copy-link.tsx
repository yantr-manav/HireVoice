"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/utils";

export function CopyLink({
  value,
  label = "Copy link",
  className,
  variant = "outline",
}: {
  value: string;
  label?: string;
  className?: string;
  variant?: "outline" | "primary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyText(value);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("The link could not be copied. Select it and copy manually.");
    }
  };

  return (
    <Button type="button" variant={variant} size="sm" className={className} onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-verified" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
