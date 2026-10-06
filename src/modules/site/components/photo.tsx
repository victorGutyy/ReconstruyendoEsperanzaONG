import { cn } from "@/lib/utils";

export type PhotoData = {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * A public photo with its three processed sizes (no image optimizer, step 8.2).
 * Width and height keep the page from jumping while it loads; `priority` is for
 * the main photo of the page (LCP), everything else loads lazily.
 */
export function Photo({
  photo,
  sizes,
  priority = false,
  className,
}: {
  photo: PhotoData;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // Our own srcset from the public bucket: next/image would spend the Vercel quota
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("h-auto w-full bg-paper-2 object-cover", className)}
    />
  );
}
