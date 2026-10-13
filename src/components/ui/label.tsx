import * as React from "react";

import { cn } from "@/lib/utils";

// A plain <label> (step 9.6): Radix's only adds a guard against selecting the
// text on double click, which `select-none` already does; without it the
// label needs no JavaScript in the browser (docs/07 §10).
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
