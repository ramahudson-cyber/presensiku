import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const PROFILE_TIMEOUT_MS = 12000;

// Bungkus promise dengan timeout supaya `loading` tidak pernah menggantung.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const applyingSession = useRef(false);

  // Satu-satunya penulis sesi: semua path bikin loading sinkron di sini,
  // jadi handler onAuthStateChange & refreshUser tidak saling menimpa / meninggalkan spinner.
  const applySession = useCallback(async (nextSession, skipLoading) => {
    if (applyingSession.current) return;
    applyingSession.current = true;
    try {
      if (!skipLoading) setLoading(true);
      setSession(nextSession);

      if (nextSession?.user) {
        try {
          const { data: profile, error } = await withTimeout(
            supabase.from("profiles")
              .select(`*,
                organization:organizations!profiles_org_fk(id,name,slug),
                override_org:organizations!profiles_active_org_override_fkey(id,name,slug)`)
              .eq("id", nextSession.user.id)
              .maybeSingle(),
            PROFILE_TIMEOUT_MS
          );
          if (error) throw error;
          if (!profile) throw new Error("Profil pengguna tidak ditemukan");
          setProfileError(null);
          setUser({ ...nextSession.user, ...profile });
        } catch (error) {
          setProfileError(error);
          setUser(null);
        }
      } else {
        setProfileError(null);
        setUser(null);
      }
    } finally {
      applyingSession.current = false;
      setLoading(false);
    }
  }, []);

  // refreshUser — dipakai di halaman login & cek approval.
  // Memberi sync update ke caller + menyinkronkan semua konsumen.
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await withTimeout(supabase.auth.getSession(), PROFILE_TIMEOUT_MS);
      await applySession(session, true);
      if (session?.user) {
        // Return userData gabungan biar caller bisa baca role/instansi langsung
        const { data: profile, error } = await supabase
          .from("profiles")
          .select(`*,
            organization:organizations!profiles_org_fk(id,name,slug),
            override_org:organizations!profiles_active_org_override_fkey(id,name,slug)`)
          .eq("id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!profile) throw new Error("Profil pengguna tidak ditemukan");
        return { ...session.user, ...profile };
      }
      return null;
    } catch (err) {
      console.error("❌ Error in refreshUser:", err);
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), PROFILE_TIMEOUT_MS);
        if (cancelled) return;
        await applySession(session, false);
      } catch (err) {
        console.warn("⚠️ Session init failed or timed out:", err.message);
        if (!cancelled) setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe ke perubahan auth. Handler TIDAK menunggu mengatur loading abadi:
    // pakai applySession yang selalu menutup loading di `finally`.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfileError(null);
        setLoading(false);
        return;
      }
      applySession(nextSession, true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthenticated = !!session;

  // Mode akses instansi (platform switch): org target + helper kembali
  const switchedOrg = user?.override_org ?? null;

  const switchBack = useCallback(async () => {
    const { data, error } = await supabase.rpc("platform_switch_back");
    if (error) throw error;
    if (data?.success === false) throw new Error(data.error);
    await refreshUser();
    return data;
  }, [refreshUser]);

  const value = {
    user,
    session,
    loading,
    profileError,
    isAuthenticated,
    switchedOrg,
    switchBack,
    refreshUser,
    setUser,
    setSession,
    setLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
