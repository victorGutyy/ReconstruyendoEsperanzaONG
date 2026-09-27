import type { NavItem } from "../navigation";
import { MobileBar, SidebarNav } from "./panel-nav";

type ShellUser = { fullName: string; roleLabel: string };

function Brand() {
  return (
    <p className="font-serif text-lg leading-tight font-semibold text-green-900">
      <span className="block font-sans text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Panel
      </span>
      Reconstruyendo Esperanza
    </p>
  );
}

function Account({ user, signOut }: { user: ShellUser; signOut: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <span className="block font-semibold break-words">{user.fullName}</span>
        <span className="text-ink-muted">{user.roleLabel}</span>
      </p>
      {signOut}
    </div>
  );
}

/**
 * Panel frame (docs/07 §6.6): sidebar on desktop, bottom bar on phones. It only
 * lays things out: every page and action still checks its own permission.
 * The sign-out control comes from the route (the auth module owns it).
 */
export function AdminShell({
  items,
  user,
  signOut,
  children,
}: {
  items: NavItem[];
  user: ShellUser;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-card px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      <header className="border-b-[3px] border-double border-gold-500 bg-card px-4 py-3 md:hidden">
        <Brand />
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r bg-card p-4 md:flex">
        <div className="border-b-[3px] border-double border-gold-500 pb-4">
          <Brand />
        </div>
        <div className="flex-1">
          <SidebarNav items={items} />
        </div>
        <Account user={user} signOut={signOut} />
      </aside>

      <main id="contenido" tabIndex={-1} className="min-w-0 pb-24 outline-none md:pb-0">
        {children}
      </main>

      <MobileBar items={items} footer={<Account user={user} signOut={signOut} />} />
    </div>
  );
}
