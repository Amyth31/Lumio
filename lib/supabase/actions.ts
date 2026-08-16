"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) redirect("/login?error=Could not authenticate with Google");
  redirect(data.url);
}

export async function signInAsGuest() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) redirect("/login?error=Could not start guest session");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}