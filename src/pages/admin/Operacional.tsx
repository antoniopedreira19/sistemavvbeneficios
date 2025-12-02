import { Briefcase } from "lucide-react";

const Operacional = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Briefcase className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Operacional</h1>
      </div>
      <p className="text-muted-foreground">
        Kanban de gestão de lotes - em desenvolvimento.
      </p>
    </div>
  );
};

export default Operacional;
