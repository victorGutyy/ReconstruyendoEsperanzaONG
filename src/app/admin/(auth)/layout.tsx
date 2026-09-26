// Sign-in screens: a centred card, mobile first (docs/07 §6.5)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
          Panel
        </p>
        <p className="mt-1 mb-6 border-b-[3px] border-double border-gold-500 pb-4 text-center font-serif text-2xl font-semibold text-green-900">
          Reconstruyendo Esperanza
        </p>
        <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
