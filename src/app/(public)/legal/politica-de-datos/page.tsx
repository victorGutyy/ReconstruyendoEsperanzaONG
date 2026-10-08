import { LegalPage, legalMetadata } from "@/modules/pages/components/legal-page";

export const revalidate = 300;

export const generateMetadata = () => legalMetadata("privacy-policy");

export default function PrivacyPolicyPage() {
  return <LegalPage pageKey="privacy-policy" />;
}
