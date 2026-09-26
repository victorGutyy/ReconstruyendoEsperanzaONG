import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import { signOut } from "../actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        <LogOut aria-hidden="true" />
        Cerrar sesión
      </Button>
    </form>
  );
}
