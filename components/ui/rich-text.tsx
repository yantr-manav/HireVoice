"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "hr" }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "kv"; rows: { label: string; value: string }[] }
  | { kind: "paragraph"; lines: string[] };

const BULLET_RE = /^\s*(?:[-*•·])\s+(.+)$/;
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.+)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const ALL_CAPS_HEADING_RE = /^[A-Z][A-Z0-9\s&/—–-]{3,52}$/;
const HR_RE = /^\s*[-—_=]{4,}\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const KV_RE = /^([A-Za-z][A-Za-z0-9\s/&()-]{1,32}):\s+(.+)$/;

function parseBlocks(raw: string): Block[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (HR_RE.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    if (ALL_CAPS_HEADING_RE.test(trimmed) && trimmed.length <= 54 && !trimmed.includes(":")) {
      blocks.push({ kind: "heading", level: 3, text: trimmed });
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        const m = lines[i].match(QUOTE_RE);
        if (m) quoteLines.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        const m = lines[i].match(BULLET_RE);
        if (m) items.push(m[1].trim());
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        const m = lines[i].match(ORDERED_RE);
        if (m) items.push(m[2].trim());
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Detect consecutive key: value lines (2+ lines) as a crisp metadata card
    if (KV_RE.test(trimmed) && i + 1 < lines.length && KV_RE.test(lines[i + 1].trim())) {
      const rows: { label: string; value: string }[] = [];
      while (i < lines.length && KV_RE.test(lines[i].trim())) {
        const m = lines[i].trim().match(KV_RE);
        if (m) rows.push({ label: m[1].trim(), value: m[2].trim() });
        i += 1;
      }
      blocks.push({ kind: "kv", rows });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HR_RE.test(lines[i].trim()) &&
      !HEADING_RE.test(lines[i].trim()) &&
      !BULLET_RE.test(lines[i]) &&
      !ORDERED_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !(ALL_CAPS_HEADING_RE.test(lines[i].trim()) && !lines[i].includes(":"))
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "paragraph", lines: paraLines });
    }
  }

  return blocks;
}

const INLINE_TOKEN_RE =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s<>)"]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(INLINE_TOKEN_RE.source, "g");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token.slice(0, 12)}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={key}
          className="rounded-[4px] border border-rule bg-chalk px-1 py-0.5 font-mono text-[0.9em] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      const cleaned = token.replace(/[.,;:!?]+$/, "");
      const trailing = token.slice(cleaned.length);
      parts.push(
        <React.Fragment key={key}>
          <a
            href={cleaned}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 break-all font-medium text-ultramarine underline decoration-ultramarine/30 underline-offset-2 hover:decoration-ultramarine"
          >
            {cleaned.replace(/^https?:\/\//, "")}
            <ExternalLink className="inline h-2.5 w-2.5 shrink-0" />
          </a>
          {trailing}
        </React.Fragment>,
      );
    } else if (token.includes("@")) {
      parts.push(
        <a
          key={key}
          href={`mailto:${token}`}
          className="font-medium text-ultramarine hover:underline"
        >
          {token}
        </a>,
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function RichText({
  text,
  className,
  compact = false,
}: {
  text: string;
  className?: string;
  compact?: boolean;
}) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={cn(compact ? "space-y-2 text-[11.5px] leading-[1.6]" : "space-y-3 text-[12.5px] leading-[1.7]", "text-ink/90", className)}>
      {blocks.map((block, idx) => {
        if (block.kind === "hr") {
          return <hr key={idx} className="my-2 border-t border-rule" />;
        }
        if (block.kind === "heading") {
          return (
            <p
              key={idx}
              className={cn(
                "font-semibold tracking-[-0.015em] text-ink",
                block.level === 1
                  ? "text-[14px]"
                  : block.level === 2
                    ? "text-[13px]"
                    : "pt-1 text-[10.5px] uppercase tracking-[0.07em] text-slate",
              )}
            >
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.kind === "quote") {
          return (
            <blockquote
              key={idx}
              className="rounded-r-[6px] border-l-2 border-ultramarine/40 bg-chalk/60 px-3 py-2 text-[11.5px] text-slate"
            >
              {block.lines.map((line, lIdx) => (
                <p key={lIdx}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={idx} className="space-y-1.5 pl-1">
              {block.items.map((item, itemIdx) => {
                const kv = item.match(KV_RE);
                return (
                  <li key={itemIdx} className="flex items-start gap-2">
                    <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-ultramarine/60" />
                    <span className="min-w-0 flex-1">
                      {kv ? (
                        <>
                          <span className="font-medium text-ink">{kv[1]}:</span>{" "}
                          <span className="text-ink/85">{renderInline(kv[2])}</span>
                        </>
                      ) : (
                        renderInline(item)
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={idx} className="space-y-1.5 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rule bg-white font-mono text-[9px] font-medium text-slate">
                    {itemIdx + 1}
                  </span>
                  <span className="min-w-0 flex-1">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (block.kind === "kv") {
          return (
            <dl
              key={idx}
              className="divide-y divide-rule/70 rounded-[8px] border border-rule bg-chalk/45 px-3 py-1"
            >
              {block.rows.map((row, rIdx) => (
                <div key={rIdx} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-[11.5px]">
                  <dt className="font-medium text-slate">{row.label}</dt>
                  <dd className="text-right font-medium text-ink">{renderInline(row.value)}</dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <p key={idx} className="text-ink/90">
            {block.lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 ? <br /> : null}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
