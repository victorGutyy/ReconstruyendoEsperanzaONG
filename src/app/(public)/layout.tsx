import { PublicFrame } from "@/modules/site";

// Cached and refreshed every 5 minutes (scheduled content, the date); changes
// from the panel show at once through revalidatePublicSite() (step 8.1).
export const revalidate = 300;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <PublicFrame>{children}</PublicFrame>;
}
