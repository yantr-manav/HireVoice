import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-chalk">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4 sm:px-6">
          <Logo />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="max-w-[420px] text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-paper">
            <SearchX className="h-5 w-5 text-slate" />
          </div>
          <h1 className="mt-4 font-display text-[32px] font-medium tracking-[-0.04em] text-ink">
            That page is not here.
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
            The link may be old, or the candidate may have been removed. Nothing was deleted by opening
            this page.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" size="md" asChild>
              <Link href="/app">Recruiter desk</Link>
            </Button>
            <Button variant="ink" size="md" asChild>
              <Link href="/demo">Demo guide</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
