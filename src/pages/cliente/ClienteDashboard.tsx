import { Upload } from "lucide-react";

const ClienteDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Painel</h1>
      </div>
      <p className="text-muted-foreground">
        Central de ações e upload - em desenvolvimento.
      </p>
    </div>
  );
};

export default ClienteDashboard;
