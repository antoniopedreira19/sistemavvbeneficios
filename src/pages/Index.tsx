import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import FirstLoginPasswordDialog from "@/components/FirstLoginPasswordDialog";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, isAdminOrOperacional, isFinanceiro, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!authLoading && !roleLoading && user && role) {
      const isFirstLogin = user.user_metadata?.first_login !== false;
      
      if (role === "cliente" && isFirstLogin) {
        setShowPasswordDialog(true);
        return;
      }

      if (isAdminOrOperacional) {
        navigate("/admin/dashboard");
      } else if (isFinanceiro) {
        navigate("/admin/financeiro");
      } else {
        navigate("/cliente/dashboard");
      }
    }
  }, [user, role, isAdminOrOperacional, isFinanceiro, authLoading, roleLoading, navigate]);

  const handlePasswordChanged = () => {
    setShowPasswordDialog(false);
    navigate("/cliente/dashboard");
  };

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
