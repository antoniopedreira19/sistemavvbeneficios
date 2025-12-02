import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import FirstLoginPasswordDialog from "@/components/FirstLoginPasswordDialog";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, isAdmin, isAdminOrOperacional, isFinanceiro, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    console.log("Index - authLoading:", authLoading, "roleLoading:", roleLoading);
    console.log("Index - user:", user?.email);
    console.log("Index - role:", role);
    console.log("Index - isAdmin:", isAdmin);
    
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    // Check if it's first login for client users
    if (!authLoading && !roleLoading && user && role) {
      const isFirstLogin = user.user_metadata?.first_login !== false;
      
      if (role === "cliente" && isFirstLogin) {
        setShowPasswordDialog(true);
        return;
      }

      // Only redirect when we have both user and role defined
      console.log("Index - Redirecting based on role. isAdminOrOperacional:", isAdminOrOperacional);
      if (isAdminOrOperacional) {
        console.log("Index - Navigating to /admin/pendencias");
        navigate("/admin/pendencias");
      } else if (isFinanceiro) {
        console.log("Index - Navigating to /admin/indicadores (financeiro)");
        navigate("/admin/indicadores");
      } else {
        console.log("Index - Navigating to /cliente/obras");
        navigate("/cliente/obras");
      }
    }
  }, [user, role, isAdminOrOperacional, isFinanceiro, authLoading, roleLoading, navigate]);

  const handlePasswordChanged = () => {
    setShowPasswordDialog(false);
    navigate("/cliente/obras");
  };

  // Always show loading while determining where to redirect
  return (
    <>
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
      <FirstLoginPasswordDialog 
        open={showPasswordDialog} 
        onPasswordChanged={handlePasswordChanged}
      />
    </>
  );
};

export default Index;
