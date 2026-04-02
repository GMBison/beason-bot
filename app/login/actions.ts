"use server";

import { redirect } from "next/navigation";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    redirect("/login?error=invalid");
  }

  const token = await createSessionToken({ username });
  await setSessionCookie(token);
  redirect("/dashboard");
}
