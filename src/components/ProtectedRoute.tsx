import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAdminOnly?: boolean;
  requireAdminOrFinanceiro?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, requireAdminOnly = false, requireAdminOrFinanceiro = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading) {
      if (requireAdminOnly && role !== "admin") {
        navigate("/");
      } else if (requireAdmin && role !== "admin" && role !== "operacional") {
        navigate("/");
      } else if (requireAdminOrFinanceiro && role !== "admin" && role !== "financeiro") {
        navigate("/");
      }
    }
  }, [role, roleLoading, requireAdmin, requireAdminOnly, requireAdminOrFinanceiro, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireAdminOnly && role !== "admin") {
    return null;
  }

  if (requireAdmin && role !== "admin" && role !== "operacional") {
    return null;
  }

  if (requireAdminOrFinanceiro && role !== "admin" && role !== "financeiro") {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
