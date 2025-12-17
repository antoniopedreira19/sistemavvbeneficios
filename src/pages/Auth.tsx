import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo-vv-beneficios.png";
import logoSidebar from "@/assets/logo-vv-sidebar.png";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Cores do sistema para consistência
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
          title: "Bem-vindo de volta!",
          description: "Login realizado com sucesso.",
          action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      {/* COLUNA ESQUERDA - BRANDING & VISUAL */}
      <div className="hidden lg:flex relative flex-col bg-muted text-white dark:border-r overflow-hidden">
        {/* Fundo Base */}
        <div className="absolute inset-0" style={{ backgroundColor: BRAND_COLOR }} />

        {/* IMAGEM DE FUNDO COM BLEND MODE */}
        {/* Usando uma imagem de escritório/negócios abstrata para dar contexto */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1600')",
          }}
        />

        {/* Gradiente Overlay para garantir legibilidade do texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#203455] via-[#203455]/80 to-transparent" />

        {/* Header da Coluna Esquerda */}
        <div className="relative z-20 flex items-center p-10 font-medium text-lg">
          <div className="bg-white p-3 rounded-xl shadow-lg">
            <img src={logoSidebar} alt="VV Logo" className="h-10 w-auto" />
          </div>
          <span className="ml-3 font-semibold tracking-wide text-xl text-white">Sistema VV Benefícios</span>
        </div>

        {/* IMAGEM ILUSTRATIVA CENTRAL (A que você pediu) */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-12">
          <img
            src="https://illustrations.popsy.co/amber/success.svg"
            alt="Gestão de Sucesso"
            className="w-full max-w-md drop-shadow-2xl opacity-90 transform hover:scale-105 transition-transform duration-700"
          />
        </div>

        {/* Footer da Coluna Esquerda */}
        <div className="relative z-20 p-10 space-y-4">
          <blockquote className="space-y-2">
            <p className="text-2xl font-light leading-relaxed text-white/90">
              "Gestão inteligente e humanizada para o ativo mais importante da sua empresa: as pessoas."
            </p>
            <footer className="text-sm text-white/70 pt-4 border-t border-white/20">
              Sistema Integrado de Gestão &copy; {new Date().getFullYear()}
            </footer>
          </blockquote>
        </div>
      </div>

      {/* COLUNA DIREITA - FORMULÁRIO */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-8 lg:p-8 bg-background">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[400px]">
          {/* Logo visível apenas no Mobile */}
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <div className="lg:hidden mx-auto mb-4">
              <img src={logo} alt="Logo" className="h-20 w-auto" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#203455]">Acesse sua conta</h1>
            <p className="text-sm text-muted-foreground">Entre com suas credenciais corporativas para continuar.</p>
          </div>

          <div className="grid gap-6">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-5">
                {/* Input Email */}
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-[#203455] font-semibold">
                    E-mail Corporativo
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      placeholder="nome@empresa.com"
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect="off"
                      disabled={loading}
                      className="pl-10 h-11 border-gray-300 focus:border-[#203455] focus:ring-[#203455]"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Input Senha */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[#203455] font-semibold">
                      Senha
                    </Label>
                    <a href="#" className="text-xs text-[#203455] hover:underline font-medium tab-index-[-1]">
                      Esqueceu a senha?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoCapitalize="none"
                      autoComplete="current-password"
                      disabled={loading}
                      className="pl-10 pr-10 h-11 border-gray-300 focus:border-[#203455] focus:ring-[#203455]"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-[#203455] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  disabled={loading}
                  className="h-11 bg-[#203455] hover:bg-[#2c456b] text-white font-bold tracking-wide transition-all duration-200 shadow-lg hover:shadow-xl mt-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </div>
                  ) : (
                    "Entrar na Plataforma"
                  )}
                </Button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Área Segura</span>
              </div>
            </div>

            <p className="px-8 text-center text-xs text-muted-foreground">
              Ao entrar, você concorda com nossos{" "}
              <a href="#" className="underline underline-offset-4 hover:text-primary">
                Termos de Serviço
              </a>{" "}
              e{" "}
              <a href="#" className="underline underline-offset-4 hover:text-primary">
                Política de Privacidade
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
