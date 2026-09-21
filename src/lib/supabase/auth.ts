import { supabase } from "./supabase";
import { setActiveUserId } from "../skillbridge-store";

export type AuthIntent = "login" | "onboarding";

export function authenticatedDestination(intent: string): "/dashboard" | "/onboarding" {
  return intent === "onboarding" ? "/onboarding" : "/dashboard";
}

export async function getAuthenticatedSession() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message === "Auth session missing!") {
      setActiveUserId(null);
      return null;
    }

    setActiveUserId(null);
    throw error;
  }

  setActiveUserId(user?.id ?? null);
  return user;
}

export async function signUp(
  email: string,
  password: string
) {
  return await supabase.auth.signUp({
    email,
    password,
  });
}

export async function signIn(
  email: string,
  password: string
) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function sendEmailCode(email: string) {
  return await supabase.auth.signInWithOtp({ email });
}

export async function verifyEmailCode(email: string, token: string) {
  return await supabase.auth.verifyOtp({ email, token, type: "email" });
}

export async function signOut() {
  const result = await supabase.auth.signOut();
  setActiveUserId(null);
  return result;
}

export async function getCurrentUser() {
  return getAuthenticatedSession();
}