import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notificacao = await req.json();
    console.log('Notificação recebida:', notificacao);

    const webhookUrl = 'https://grifoworkspace.app.n8n.cloud/webhook/vvbeneficios';

    // Envia a notificação para o webhook do n8n
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificacao.record),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar notificação para n8n:', errorText);
      throw new Error(`Webhook retornou status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Notificação enviada com sucesso para n8n:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Erro na edge function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
