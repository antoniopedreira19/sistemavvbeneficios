import { History } from "lucide-react";

const Historico = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Histórico</h1>
      </div>
      <p className="text-muted-foreground">
        Downloads e faturas anteriores - em desenvolvimento.
      </p>
    </div>
  );
};

export default Historico;
