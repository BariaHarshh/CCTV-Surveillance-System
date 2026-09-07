import type { Metadata } from "next";
import { LoginPageContent } from "@/components/auth/LoginPageContent";

export const metadata: Metadata = {
  title: "Sign In | AI Campus Guardian",
  description: "Secure access to AI Campus Guardian platform.",
};

export default function LoginPage() {
  return <LoginPageContent />;
}
