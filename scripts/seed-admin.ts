/**
 * scripts/seed-admin.ts — idempotently provision the bootstrap administrator.
 *
 * Run with: npm run seed:admin   (loads .env.local; requires migrations applied)
 *
 * Creates `ahmedatif@meska.ai` in Supabase Auth with app_metadata.role='admin'
 * (confirmed) and a matching public.admin_profiles row. Safe to re-run: it does
 * not duplicate the user and does not overwrite a rotated password.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "ahmedatif@meska.ai";

// Minimal .env.local loader (no extra dependency) — only sets keys not already set.
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("SEED_ADMIN_PASSWORD is not set in .env.local");

  const admin = createAdminClient();

  // Idempotency: find an existing user with this email.
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === ADMIN_EMAIL);

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Ensure the role claim is correct without touching the password.
    if (existing.app_metadata?.role !== "admin") {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...existing.app_metadata, role: "admin" },
      });
      if (error) throw error;
    }
    console.log(`Admin already exists — skipping creation (${ADMIN_EMAIL}).`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created admin ${ADMIN_EMAIL}.`);
  }

  // Upsert the application-side admin profile (idempotent on the PK).
  const { error: profileError } = await admin.from("admin_profiles").upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      display_name: ADMIN_EMAIL.split("@")[0],
      role: "admin",
      full_control: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  console.log("admin_profiles row ensured. Done.");
}

main().catch((err) => {
  console.error("seed:admin failed:", err.message ?? err);
  process.exit(1);
});
