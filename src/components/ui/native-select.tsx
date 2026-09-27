import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native <select> styled like Input: accessible by default and uses the phone's
 * own picker on mobile (docs/07 §8).
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-12 w-full min-w-0 cursor-pointer rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
