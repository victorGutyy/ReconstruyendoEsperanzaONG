import { BrandLogo } from "@/components/brand-logo";

// Sign-in screens: a centred card, mobile first (docs/07 §6.5)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 border-b-[3px] border-double border-gold-500 pb-4 text-center">
          <BrandLogo
            name="Reconstruyendo Esperanza"
            sizes="16rem"
            priority
            className="mx-auto w-64"
          />
          <p className="mt-2 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            Panel
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
