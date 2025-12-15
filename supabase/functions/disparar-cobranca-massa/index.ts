import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = "https://grifoworkspace.app.n8n.cloud/webhook/cobrancas-listas";
const TEMPLATE_URL = "https://gkmobhbmgxwrpuucoykn.supabase.co/storage/v1/object/public/MainBucket/modelo_padrao.xlsx";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competencia, empresas } = await req.json();

    if (!empresas || empresas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma empresa para notificar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payload simplificado: nome, email e URL do template
    const payload = {
      competencia,
      template_url: TEMPLATE_URL,
      empresas: empresas.map((emp: { nome: string; email: string }) => ({
        nome: emp.nome,
        email: emp.email,
      })),
    };

    console.log("Enviando para n8n:", JSON.stringify(payload));

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro n8n:", errorText);
      throw new Error(`Erro n8n: ${response.status}`);
    }

    const result = await response.text();
    console.log("Resposta n8n:", result);

    return new Response(
      JSON.stringify({ success: true, message: `Cobrança enviada para ${empresas.length} empresas` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
