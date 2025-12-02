import { LayoutDashboard } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Visão Geral</h1>
      </div>
      <p className="text-muted-foreground">
        Dashboard administrativo - em desenvolvimento.
      </p>
    </div>
  );
};

export default Dashboard;
