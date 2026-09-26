// Temporary home page: checks fonts and design tokens until F8 builds the real one.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Calarcá, Quindío
      </p>
      <h1 className="mt-2 border-b-[3px] border-double border-gold-500 pb-4 font-serif text-4xl font-semibold text-green-900 md:text-6xl">
        Reconstruyendo Esperanza
      </h1>
      <p className="mt-6 text-ink-muted">Sitio en construcción.</p>
    </main>
  );
}
