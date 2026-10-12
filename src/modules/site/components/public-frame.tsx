import { absoluteUrl } from "@/lib/site/url";
import { getSiteSettings, isPending } from "@/modules/settings";

import { organizationLd } from "../seo";
import { JsonLd } from "./json-ld";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WhatsAppButton } from "./whatsapp-button";

/** Header, content and footer of every public page, also the 404. */
export async function PublicFrame({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <JsonLd
        data={organizationLd({
          name: settings.organizationName,
          url: absoluteUrl("/"),
          logo: absoluteUrl("/brand/logo-og.png"),
          description: isPending(settings.seoDescription) ? null : settings.seoDescription,
          email: settings.contactEmail,
          sameAs: Object.values(settings.socialLinks),
        })}
      />
      <SiteHeader settings={settings} />
      <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <WhatsAppButton
        number={settings.whatsappNumber}
        organizationName={settings.organizationName}
      />
    </div>
  );
}
