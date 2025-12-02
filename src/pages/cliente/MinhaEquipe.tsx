import { Users } from "lucide-react";

const MinhaEquipe = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Minha Equipe</h1>
      </div>
      <p className="text-muted-foreground">
        Gestão de obras e colaboradores - em desenvolvimento.
      </p>
    </div>
  );
};

export default MinhaEquipe;
