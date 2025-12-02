import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type UserRole = "admin" | "cliente" | "operacional" | "financeiro" | null;

interface Profile {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
}

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchRoleAndProfile = async () => {
      try {
        // Fetch role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        setRole(roleData?.role as UserRole);

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching role and profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoleAndProfile();
  }, [user]);

  return { 
    role, 
    profile, 
    loading, 
    isAdmin: role === "admin", 
    isOperacional: role === "operacional",
    isCliente: role === "cliente",
    isFinanceiro: role === "financeiro",
    isAdminOrOperacional: role === "admin" || role === "operacional"
  };
};
