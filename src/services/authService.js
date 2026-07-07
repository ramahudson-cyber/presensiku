import { supabase } from "../supabase/client";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function signIn(email, password) {
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    30000
  );

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export function listenToAuthChanges(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}