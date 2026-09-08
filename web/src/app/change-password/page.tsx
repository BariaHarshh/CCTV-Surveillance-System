"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FirstLoginPasswordForm } from "@/components/auth/FirstLoginPasswordForm";

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STAFF"]} requirePasswordChange>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <FirstLoginPasswordForm />
      </div>
    </ProtectedRoute>
  );
}
