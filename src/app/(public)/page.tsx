import { getSiteSettings, isPending } from "@/modules/settings";

export const revalidate = 300;

// Temporary home page inside the site frame; step 8.5 builds the editorial one.
export default async function Home() {
  const settings = await getSiteSettings();
  const tagline = isPending(settings.tagline) ? null : settings.tagline;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        {settings.organizationName}
      </h1>
      {tagline ? <p className="mt-4 text-lg text-ink-muted">{tagline}</p> : null}
      <p className="mt-6 text-ink-muted">Sitio en construcción.</p>
    </div>
  );
}
