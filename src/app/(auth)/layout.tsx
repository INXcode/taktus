import { type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SourceNotice } from "@/components/source-notice";

/**
 * Rahmen der Anmeldestrecke: eine Karte auf gedämpfter Fläche, ein Ziel je
 * Seite.
 *
 * Die §13-Fußzeile steht auch hier. Sie ist keine Frage der Anmeldung: Wer
 * über das Netz mit dieser Anwendung arbeitet, muss den Quelltext angeboten
 * bekommen -- und die Anmeldemaske ist der erste Bildschirm, den jemand sieht.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[26rem]">
          <p className="mb-5 flex items-center gap-2.5 px-1">
            <BrandMark className="size-3.5 shrink-0 text-primary" />
            <span className="text-md font-bold text-foreground">
              Taktus Kontor
            </span>
          </p>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-7">
            {children}
          </div>
        </div>
      </main>

      <SourceNotice />
    </div>
  );
}
