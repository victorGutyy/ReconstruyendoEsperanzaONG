import Link from "next/link";

import { cn } from "@/lib/utils";

/** A quick filter of a panel list: a link that marks the current one. */
export function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-green-700 bg-green-50 text-green-900" : "bg-card hover:border-green-700",
      )}
    >
      {children}
    </Link>
  );
}
