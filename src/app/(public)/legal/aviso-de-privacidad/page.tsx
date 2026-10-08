import { LegalPage, legalMetadata } from "@/modules/pages/components/legal-page";

export const revalidate = 300;

export const generateMetadata = () => legalMetadata("privacy-notice");

export default function PrivacyNoticePage() {
  return <LegalPage pageKey="privacy-notice" />;
}
