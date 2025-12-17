import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo-vv-beneficios.png"; // Logo colorida para usar no box branco
import logoSidebar from "@/assets/logo-vv-sidebar.png";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Cores do sistema
  const BRAND_COLOR = "#203455";

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Acesso Negado",
          description: "Credenciais inválidas. Verifique seu e-mail e senha.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login realizado",
          description: "Acessando o sistema...",
          action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      {/* --- COLUNA ESQUERDA (BRANDING) --- */}
      <div className="hidden lg:flex relative flex-col items-center justify-center bg-muted text-white h-full overflow-hidden">
        {/* Fundo Base */}
        <div className="absolute inset-0 z-0" style={{ backgroundColor: BRAND_COLOR }} />

        {/* Imagem de Fundo (Textura Profissional) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2070')",
          }}
        />

        {/* Gradiente Suave */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#203455]/50 to-[#203455]" />

        {/* CONTEÚDO CENTRALIZADO */}
        <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-8">
          {/* Logo Box com Animação Lenta */}
          {/* animate-pulse cria um efeito de respiração suave */}
          <div className="bg-white p-8 rounded-3xl shadow-2xl mb-10 animate-pulse duration-[3000ms]">
            <img src={logo} alt="VV Logo" className="h-24 w-auto object-contain" />
          </div>

          {/* Frase e Textos */}
          <blockquote className="space-y-4">
            <p className="text-3xl font-bold leading-snug tracking-tight text-white drop-shadow-md">
              "Gestão inteligente e humanizada para o ativo mais importante da sua empresa: as pessoas."
            </p>
            <div className="w-24 h-1 bg-white/30 mx-auto rounded-full my-6" /> {/* Divisor decorativo */}
            <p className="text-sm text-blue-100 font-light tracking-widest uppercase opacity-80">
              Sistema Integrado VV Benefícios
            </p>
          </blockquote>
        </div>

        {/* Rodapé Discreto */}
        <div className="absolute bottom-6 text-xs text-white/40">
          &copy; {new Date().getFullYear()} Todos os direitos reservados.
        </div>
      </div>

      {/* --- COLUNA DIREITA (LOGIN) --- */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-8 lg:p-12 bg-gray-50 h-full">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[400px] bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          {/* Mobile Header */}
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <div className="lg:hidden mx-auto mb-6">
              <img src={logo} alt="Logo" className="h-16 w-auto" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#203455]">Bem-vindo(a)</h1>
            <p className="text-sm text-muted-foreground">Insira suas credenciais para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#203455] font-semibold">
                E-mail Corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@empresa.com"
                  className="pl-10 h-11 border-gray-200 focus:border-[#203455] focus:ring-1 focus:ring-[#203455] transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#203455] font-semibold">
                  Senha
                </Label>
                <a href="#" className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 border-gray-200 focus:border-[#203455] focus:ring-1 focus:ring-[#203455] transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-[#203455] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#203455] hover:bg-[#2c456b] text-white font-bold text-base shadow-md hover:shadow-lg transition-all"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Acessando...
                </div>
              ) : (
                "Entrar na Plataforma"
              )}
            </Button>
          </form>

          <p className="px-8 text-center text-xs text-muted-foreground">Acesso restrito. Protegido por reCAPTCHA.</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
