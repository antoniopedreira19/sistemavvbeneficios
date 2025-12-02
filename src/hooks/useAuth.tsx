import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Limpar o estado local primeiro para evitar redirecionos indesejados
      setUser(null);
      setSession(null);

      // Tentar fazer logout no Supabase (escopo global)
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      // Ignorar erros de logout (sessão pode já ter expirado)
      console.log("Logout error (ignored):", error);
    } finally {
      try {
        // Forçar limpeza do token de autenticação do Supabase no localStorage
        const projectRef = "gkmobhbmgxwrpuucoykn";
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch (storageError) {
        console.log("Error clearing auth token (ignored):", storageError);
      }

      // Sempre redirecionar para auth, removendo a página anterior do histórico
      navigate("/auth", { replace: true });
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };
};
