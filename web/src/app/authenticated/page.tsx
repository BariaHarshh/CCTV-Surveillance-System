import type { Metadata } from "next";
import { AuthenticatedPageContent } from "@/components/auth/AuthenticatedPageContent";

export const metadata: Metadata = {
  title: "Authentication Successful | AI Campus Guardian",
  description: "Your account has been securely authenticated.",
  robots: { index: false, follow: false },
};

export default function AuthenticatedPage() {
  return <AuthenticatedPageContent />;
}
