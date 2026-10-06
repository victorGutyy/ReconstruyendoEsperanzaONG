"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { moveTeamMember } from "../actions";

/** Up and down for one profile: the site shows the team in this order. */
export function TeamOrderButtons({
  memberId,
  name,
  first,
  last,
}: {
  memberId: string;
  name: string;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      setError(null);
      const result = await moveTeamMember(memberId, direction);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <span className="flex items-center gap-1">
      {first ? null : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Subir: ${name}`}
          onClick={() => move("up")}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      )}
      {last ? null : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Bajar: ${name}`}
          onClick={() => move("down")}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      )}
      {error ? (
        <span role="alert" className="text-sm font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
