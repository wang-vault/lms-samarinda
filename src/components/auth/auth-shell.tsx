// Layout bersama untuk halaman login & register
import Link from "next/link";
import { Rocket } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-accent shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold">Mulai Usaha dari Nol</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <h1 className="mb-1 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mb-6 text-sm text-muted">{subtitle}</p>
            {children}
          </div>
          <div className="mt-4 text-center text-sm text-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}
