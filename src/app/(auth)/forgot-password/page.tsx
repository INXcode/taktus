import { type Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen · Taktus Kontor",
};

/** Bildschirm 2 -- Passwort zurücksetzen, samt Bestätigung. */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
