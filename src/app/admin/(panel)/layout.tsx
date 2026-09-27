import { redirect } from "next/navigation";

import { isAuthError } from "@/lib/auth/errors";
import { LOGIN_PATH, MFA_PATH } from "@/lib/auth/rules";
import { getCurrentProfile, requireAal2 } from "@/lib/auth/session";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { AdminShell } from "@/modules/panel/components/admin-shell";
import { navFor } from "@/modules/panel/navigation";
import { roleLabel } from "@/modules/users/schema";

// The frame needs the user and their permissions to build the menu. Layouts do
// not protect pages or actions on their own: each one keeps its own check.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAal2();
  } catch (error) {
    if (isAuthError(error)) redirect(error.code === "MFA_REQUIRED" ? MFA_PATH : LOGIN_PATH);
    throw error;
  }

  const profile = await getCurrentProfile();

  return (
    <AdminShell
      items={navFor(profile)}
      user={{
        fullName: profile?.fullName ?? "Equipo",
        roleLabel: roleLabel(profile?.roleKey ?? null),
      }}
      signOut={<SignOutButton />}
    >
      {children}
    </AdminShell>
  );
}
