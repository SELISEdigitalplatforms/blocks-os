import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { KeyRound, Lock, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle/mode-toggle"

export interface AuthPageShellProps {
  badge: string
  title: string
  subtitle?: string
  children: ReactNode
  logoHref?: string
}

export const AuthPageShell = ({
  badge,
  title,
  subtitle,
  children,
  logoHref = "/login",
}: AuthPageShellProps) => {
  const logo = <Logo width={120} height={52} />

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[hsl(var(--surface-app))]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center px-6 py-5 xl:px-[154px]">
        {logoHref ? (
          <Link to={logoHref} className="transition-opacity hover:opacity-80">
            {logo}
          </Link>
        ) : (
          logo
        )}
        <div className="absolute right-6 top-5 xl:right-[154px]">
          <ModeToggle />
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-8">
          <div className="w-full max-w-[420px]">
            <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--card))] shadow-md">
              <div className="relative overflow-hidden rounded-t-2xl blocks-gradient px-6 py-7">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 right-4 h-20 w-20 rounded-full bg-white/5" />
                <span className="relative inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/80">
                  {badge}
                </span>
                <div className="relative mt-3">
                  <h1 className="text-lg font-bold leading-tight text-primary-foreground">{title}</h1>
                  {subtitle ? (
                    <p className="mt-0.5 text-xs text-primary-foreground/70">{subtitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="p-6">{children}</div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--low-emphasis))]">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                MFA Ready
              </div>
              <span className="h-3 w-px bg-[hsl(var(--border-default))]" />
              <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--low-emphasis))]">
                <KeyRound className="h-3.5 w-3.5 text-primary/60" />
                SSO Enabled
              </div>
              <span className="h-3 w-px bg-[hsl(var(--border-default))]" />
              <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--low-emphasis))]">
                <Lock className="h-3.5 w-3.5 text-primary/60" />
                Encrypted
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-[hsl(var(--low-emphasis))]">
              © {new Date().getFullYear()} SELISE Digital Platforms. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
