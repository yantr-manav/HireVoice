"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@radix-ui/react-dialog";
import {
  AudioLines,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileSignature,
  FileText,
  Home,
  Kanban,
  Keyboard,
  LogOut,
  Mail,
  Menu,
  Mic,
  Plug,
  QrCode,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/badge";
import { VoiceDialog } from "@/components/voice/voice-dialog";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const coreNav = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/voice", label: "Voice", icon: AudioLines },
  { href: "/app/drive", label: "Drive Mode", icon: QrCode },
  { href: "/app/roles", label: "Roles", icon: BriefcaseBusiness },
  { href: "/app/review", label: "Review", icon: ClipboardCheck },
  { href: "/app/playbooks", label: "Playbooks", icon: FileText },
  { href: "/app/upload-call", label: "Upload Call", icon: UploadCloud },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

const workspaceNav = [
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/mail", label: "Mail", icon: Mail },
  { href: "/app/sheets", label: "Sheets", icon: Table2 },
  { href: "/app/forms", label: "Forms", icon: ClipboardList },
  { href: "/app/offer", label: "Offers", icon: FileSignature },
  { href: "/app/crew", label: "Crew", icon: Cpu },
  { href: "/app/connections", label: "Connections", icon: Plug },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

const baseNav = [...coreNav, ...workspaceNav];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export function DeskShell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key.toLowerCase() === "j" && !typing) {
        event.preventDefault();
        setVoiceOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workspace.candidates.slice(0, 5);
    return workspace.candidates
      .filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(term) ||
          candidate.alias.toLowerCase().includes(term) ||
          candidate.email.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [query, workspace.candidates]);

  const pending = workspace.approvals.filter((approval) => approval.status === "pending").length;
  const inReviewCount = workspace.candidates.filter((c) => c.stage === "in_review").length;

  const nav = useMemo(
    () =>
      baseNav.map((item) => {
        if (item.href === "/app/review" && inReviewCount > 0) {
          return { ...item, count: String(inReviewCount), alert: false };
        }
        if (item.href === "/app/crew" && pending > 0) {
          return { ...item, count: String(pending), alert: false };
        }
        if (item.href === "/app/connections") {
          return { ...item, count: undefined, alert: !workspace.google.connected };
        }
        return { ...item, count: undefined, alert: false };
      }),
    [inReviewCount, pending, workspace.google.connected],
  );

  return (
    <div className="min-h-dvh bg-chalk">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[208px] flex-col border-r border-rule bg-chalk lg:flex">
        <div className="flex h-12 items-center border-b border-rule px-4">
          <Logo href="/app" />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 scroll-thin" aria-label="Desk">
          <p className="px-2.5 pb-1 text-[9px] font-medium uppercase tracking-[0.08em] text-slate/65">
            Screening Core
          </p>
          <ul className="space-y-0.5">
            {nav.slice(0, coreNav.length).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] transition-colors",
                      active ? "bg-white/60 font-medium text-ink" : "text-slate hover:bg-ink/[0.04] hover:text-ink",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active ? <span className="absolute -left-2 top-2 h-5 w-[2px] rounded-full bg-ink" /> : null}
                    <item.icon className={cn("h-4 w-4", active ? "text-ink" : "text-slate/80")} strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {item.count ? (
                      <span className="ml-auto rounded-[3px] border border-rule bg-white px-1 font-mono text-[9.5px] text-slate">
                        {item.count}
                      </span>
                    ) : null}
                    {item.alert ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-onair" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer list-none px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-slate/65 hover:text-ink">
              Workspace Tools ▾
            </summary>
            <ul className="mt-1 space-y-0.5">
              {nav.slice(coreNav.length).map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-[12.5px] transition-colors",
                        active ? "bg-white/60 font-medium text-ink" : "text-slate hover:bg-ink/[0.04] hover:text-ink",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active ? <span className="absolute -left-2 top-1.5 h-5 w-[2px] rounded-full bg-ink" /> : null}
                      <item.icon className={cn("h-3.5 w-3.5", active ? "text-ink" : "text-slate/80")} strokeWidth={1.7} />
                      <span>{item.label}</span>
                      {item.count ? (
                        <span className="ml-auto rounded-[3px] border border-rule bg-white px-1 font-mono text-[9.5px] text-slate">
                          {item.count}
                        </span>
                      ) : null}
                      {item.alert ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-onair" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </nav>
        <div className="border-t border-rule p-3">
          <div className="rounded-[8px] border border-rule bg-paper p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-verified" strokeWidth={1.8} />
              <span className="text-[11px] font-medium text-ink">Human decision</span>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate">
              AI never rejects a candidate. Every outcome is approved by a recruiter.
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-[10.5px] text-slate">
              {workspace.isDemo ? "Demo workspace" : "Preview workspace"}
            </span>
            <span className="font-mono text-[9.5px] text-slate/60">asia-south1</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[208px]">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-rule bg-chalk/92 px-3 backdrop-blur-md sm:px-4">
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-rule bg-chalk p-0">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <div className="flex h-12 items-center justify-between border-b border-rule px-4">
                <Logo href="/app" />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="p-2" aria-label="Desk mobile">
                <ul className="space-y-0.5">
                  {nav.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex h-10 items-center gap-3 rounded-[6px] px-3 text-[13px]",
                            active ? "bg-white font-medium text-ink" : "text-slate",
                          )}
                        >
                          {active ? <span className="absolute left-0 h-5 w-[2px] rounded-full bg-ink" /> : null}
                          <item.icon className="h-4 w-4" strokeWidth={1.7} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="absolute inset-x-3 bottom-4 rounded-[8px] border border-rule bg-paper p-3 text-[10.5px] leading-relaxed text-slate">
                Recruiter decisions stay human. AI suggestions are never auto-rejections.
              </div>
            </DialogContent>
          </Dialog>

          <div className="hidden min-w-0 flex-1 sm:block">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex h-8 w-full max-w-[360px] items-center gap-2 rounded-[6px] border border-rule bg-paper px-2.5 text-left text-[12px] text-slate transition hover:border-slate/50 hover:bg-white"
            >
              <Search className="h-3.5 w-3.5 text-slate/70" strokeWidth={1.8} />
              <span className="truncate">Search candidates, roles or ask…</span>
              <span className="ml-auto flex items-center gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="flex items-center gap-2 rounded-full border border-ultramarine/30 bg-ink px-3 py-1.5 text-[11.5px] font-medium text-chalk shadow-sm transition hover:bg-[#1b2942]"
              aria-label="Ask Vaani voice assistant"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-glow/20 text-glow">
                <Mic className="h-2.5 w-2.5" strokeWidth={2.2} />
              </span>
              <span>Ask Vaani</span>
              <span className="ml-0.5 hidden items-center gap-1 text-mist/50 sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>J</Kbd>
              </span>
            </button>
            <Link
              href="/app/crew"
              className="hidden items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-[11px] text-slate transition hover:border-slate/50 sm:flex"
            >
              <StatusDot status={pending > 0 ? "waiting" : "idle"} />
              <span>{pending > 0 ? `Crew · ${pending} need approval` : "Crew idle"}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-transparent p-0.5 pr-1 transition hover:border-rule hover:bg-white"
                  aria-label="Account menu"
                >
                  <Avatar initials={workspace.user.initials} size="sm" />
                  <span className="hidden text-[12px] font-medium text-ink md:block">{workspace.user.name.split(" ")[0]}</span>
                  <ChevronsUpDown className="hidden h-3 w-3 text-slate md:block" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[238px] rounded-[10px] border border-rule bg-paper p-1 shadow-[0_20px_60px_-20px_rgba(11,16,48,0.35)]"
                >
                  <div className="px-2.5 py-2">
                    <p className="text-[12px] font-medium text-ink">{workspace.user.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate">{workspace.user.email}</p>
                    <p className="mt-1.5 text-[10px] text-slate/80">
                      {workspace.org.name} · {workspace.isDemo ? "Demo workspace" : "Recruiter"}
                    </p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/app/settings"
                      className="flex h-8 cursor-pointer items-center gap-2 rounded-[5px] px-2.5 text-[12px] text-ink outline-none focus:bg-ultramarine-soft"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-slate" />
                      Workspace settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/app/connections"
                      className="flex h-8 cursor-pointer items-center gap-2 rounded-[5px] px-2.5 text-[12px] text-ink outline-none focus:bg-ultramarine-soft"
                    >
                      <Plug className="h-3.5 w-3.5 text-slate" />
                      Connections
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                  <DropdownMenu.Item asChild>
                    <form action="/auth/sign-out" method="post" className="block">
                      <button
                        type="submit"
                        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2.5 text-left text-[12px] text-ink outline-none hover:bg-onair-soft focus:bg-onair-soft"
                      >
                        <LogOut className="h-3.5 w-3.5 text-slate" />
                        Sign out
                      </button>
                    </form>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <main>{children}</main>
      </div>

      <Command.Dialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        label="Command palette"
        className="fixed left-1/2 top-[16%] z-50 w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[20px] border border-rule bg-paper shadow-[0_30px_100px_-20px_rgba(11,16,48,0.45)]"
        overlayClassName="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]"
      >
        <div className="flex items-center gap-2 border-b border-rule px-4">
          <Search className="h-4 w-4 text-slate" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search, navigate, or ask Hirevoice…"
            className="h-12 w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-slate/70"
          />
          <Kbd>esc</Kbd>
        </div>
        <Command.List className="max-h-[440px] overflow-y-auto p-2 scroll-thin">
          <Command.Empty className="px-3 py-8 text-center text-[12px] text-slate">
            No matches. Try a candidate name, alias or page.
          </Command.Empty>

          <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate">
            {nav.map((item) => (
              <Command.Item
                key={item.href}
                value={`go ${item.label}`}
                onSelect={() => {
                  router.push(item.href);
                  setPaletteOpen(false);
                }}
                className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
              >
                <item.icon className="h-3.5 w-3.5 text-slate" />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Candidates" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate">
            {candidates.map((candidate) => (
              <Command.Item
                key={candidate.id}
                value={`candidate ${candidate.name} ${candidate.alias}`}
                onSelect={() => {
                  router.push(`/app/roles/${candidate.roleId}/candidates/${candidate.id}`);
                  setPaletteOpen(false);
                }}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
              >
                <Avatar initials={candidate.name.split(" ").map((part) => part[0]).join("")} size="xs" />
                <span className="min-w-0 flex-1 truncate">
                  {candidate.name}
                  <span className="ml-2 font-mono text-[10px] text-slate">{candidate.alias}</span>
                </span>
                <span className="font-mono text-[10.5px] tabular text-slate">{candidate.score.overall.toFixed(1)}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate">
            <Command.Item
              value="open candidate pipeline board"
              onSelect={() => {
                router.push("/app/pipeline");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <Kanban className="h-3.5 w-3.5 text-slate" />
              Open candidate pipeline board
            </Command.Item>
            <Command.Item
              value="create google application form"
              onSelect={() => {
                router.push("/app/forms");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <ClipboardList className="h-3.5 w-3.5 text-slate" />
              Create Google Application Form
            </Command.Item>
            <Command.Item
              value="open sheets studio clean messy data"
              onSelect={() => {
                router.push("/app/sheets");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <Table2 className="h-3.5 w-3.5 text-slate" />
              Open Sheets Studio & Data Cleaner
            </Command.Item>
            <Command.Item
              value="generate offer letter studio"
              onSelect={() => {
                router.push("/app/offer");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <FileSignature className="h-3.5 w-3.5 text-slate" />
              Generate Offer Letter
            </Command.Item>
            <Command.Item
              value="open review queue"
              onSelect={() => {
                router.push("/app/review");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <ClipboardCheck className="h-3.5 w-3.5 text-slate" />
              Review the 6 candidates waiting
              <span className="ml-auto font-mono text-[9.5px] text-slate">R</span>
            </Command.Item>
            <Command.Item
              value="open playbook studio"
              onSelect={() => {
                router.push("/app/playbooks/support-exec");
                setPaletteOpen(false);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <FileText className="h-3.5 w-3.5 text-slate" />
              Open Playbook Studio
            </Command.Item>
            <Command.Item
              value="voice command vaani"
              onSelect={() => {
                setPaletteOpen(false);
                setVoiceOpen(true);
              }}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <AudioLines className="h-3.5 w-3.5 text-slate" />
              Give Vaani a voice command
              <span className="ml-auto flex gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>J</Kbd>
              </span>
            </Command.Item>
            <Command.Item
              value="keyboard shortcuts"
              onSelect={() => setPaletteOpen(false)}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
            >
              <Keyboard className="h-3.5 w-3.5 text-slate" />
              Keyboard shortcuts
              <span className="ml-auto flex gap-1">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                <Kbd>A</Kbd>
              </span>
            </Command.Item>
          </Command.Group>

          {query.trim().length > 2 ? (
            <Command.Group heading="Ask Hirevoice" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate">
              <Command.Item
                value={`ask ${query}`}
                onSelect={() => {
                  router.push(`/app/ask?q=${encodeURIComponent(query)}`);
                  setPaletteOpen(false);
                }}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] text-ink aria-selected:bg-ultramarine-soft"
              >
                <Sparkles className="h-3.5 w-3.5 text-ultramarine" />
                Ask “{query}”
                <span className="ml-auto text-[10px] text-slate">read-only</span>
              </Command.Item>
            </Command.Group>
          ) : null}
        </Command.List>
        <div className="flex items-center justify-between border-t border-rule bg-chalk/60 px-4 py-2">
          <span className="text-[10px] text-slate">Search runs only over this workspace.</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate">
            <Check className="h-3 w-3 text-verified" /> no automatic decisions
          </span>
        </div>
      </Command.Dialog>

      <VoiceDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
    </div>
  );
}

export function DemoRibbon({ workspace }: { workspace: Workspace }) {
  if (!workspace.isDemo) return null;
  return (
    <div className="flex items-center gap-2 border-b border-ultramarine/15 bg-ultramarine-soft px-4 py-1.5 text-[11px] text-[#2536c9]">
      <LogoMark className="h-4 w-4 rounded-[3px] pb-1" />
      <span>
        You are in the demo workspace. Decisions here do not affect real candidates.
      </span>
      <Link href="/demo" className="ml-auto font-medium underline underline-offset-2">
        Judge view
      </Link>
    </div>
  );
}
