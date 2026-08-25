"use client";
import { createAdminClient } from "@/lib/supabase/admin";
export function Schlecht({ html }: { html: string }) {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const db = createAdminClient();
  console.error("Fehler fuer", userEmail, db, key);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
