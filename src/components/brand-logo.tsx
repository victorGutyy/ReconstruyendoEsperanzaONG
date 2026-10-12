import { cn } from "@/lib/utils";

// Processed by scripts/prepare-logo.mjs from the organization's logo
const FULL = {
  width: 420,
  height: 189,
  srcSet: "/brand/logo-420.webp 420w, /brand/logo-840.webp 840w",
};
const LEAVES = { src: "/brand/icon-180.png", size: 180 };

/**
 * The full logo (docs/07 §3.1). Its alternative text is the name, so screen
 * readers and search engines still read it. Under ~250 px wide the script
 * lettering stops being legible: use BrandMark there.
 */
export function BrandLogo({
  name,
  sizes,
  priority = false,
  className,
}: {
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // A fixed local file, already optimized: no image optimizer needed
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-420.webp"
      srcSet={FULL.srcSet}
      sizes={sizes}
      width={FULL.width}
      height={FULL.height}
      alt={name}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("h-auto", className)}
    />
  );
}

/** Small spaces (phone header, panel sidebar): the leaves + the name in Fraunces. */
export function BrandMark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LEAVES.src} width={LEAVES.size} height={LEAVES.size} alt="" className="size-11" />
      <span className="leading-tight">
        <span className="block font-serif text-lg leading-tight font-semibold text-green-900">
          {name}
        </span>
        <span className="block text-[0.7rem] font-semibold tracking-[0.2em] text-gold-700 uppercase">
          Calarcá
        </span>
      </span>
    </span>
  );
}

/**
 * The masthead: the leaves and the name on phones, the full logo from tablets
 * up (docs/07 §3.1). One <picture>, so a phone never downloads the large logo.
 */
export function MastheadLogo({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <picture>
        <source
          media="(min-width: 768px)"
          srcSet={FULL.srcSet}
          sizes="17rem"
          width={FULL.width}
          height={FULL.height}
        />

        <img
          src={LEAVES.src}
          width={LEAVES.size}
          height={LEAVES.size}
          alt={name}
          fetchPriority="high"
          className="size-11 md:h-auto md:w-[17rem]"
        />
      </picture>
      <span aria-hidden="true" className="leading-tight md:hidden">
        <span className="block font-serif text-lg leading-tight font-semibold text-green-900">
          {name}
        </span>
        <span className="block text-[0.7rem] font-semibold tracking-[0.2em] text-gold-700 uppercase">
          Calarcá
        </span>
      </span>
    </span>
  );
}
