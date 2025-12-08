import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "npm:googleapis@126.0.1";
import { stream } from "npm:stream-browserify@3.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const empresaId = formData.get("empresaId") as string;
    const empresaNome = formData.get("empresaNome") as string;

    if (!file || !empresaId || !empresaNome) {
      throw new Error("Arquivo, ID da empresa e Nome são obrigatórios");
    }

    console.log(`[Upload] Iniciando: ${empresaNome}`);

    // 1. Autenticação Google
    const credentialsStr = Deno.env.get("GOOGLE_CREDENTIALS");
    if (!credentialsStr) throw new Error("Credenciais do Google ausentes");

    const credentials = JSON.parse(credentialsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    // --- CORREÇÃO: ID FIXO DA PASTA ---

    // ID da pasta 'CONTRATOS_GERAL_VV' que você criou e compartilhou
    const mainFolderId = "1h7PizLVrRJIOfPrGPCfysecIqjewfiXe";

    console.log(`[Drive] Usando pasta raiz fixa: ${mainFolderId}`);

    // 3. Buscar ou Criar a Subpasta da Empresa
    const subFolderName = `CONTRATO_${empresaNome.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    let subFolderId = "";

    try {
      // Procura subpasta DENTRO da pasta raiz fixa
      const subFolderSearch = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${subFolderName}' and '${mainFolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
      });

      if (subFolderSearch.data.files && subFolderSearch.data.files.length > 0) {
        subFolderId = subFolderSearch.data.files[0].id!;
        console.log(`[Drive] Subpasta encontrada: ${subFolderId}`);
      } else {
        console.log(`[Drive] Criando subpasta: ${subFolderName}`);
        const folder = await drive.files.create({
          requestBody: {
            name: subFolderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [mainFolderId], // Cria DENTRO da pasta fixa
          },
          fields: "id",
        });
        subFolderId = folder.data.id!;
      }
    } catch (folderError: any) {
      console.error("[Drive] Erro na estrutura de pastas:", folderError);
      throw new Error(
        `Erro ao acessar pasta do Drive. Verifique se o email da Service Account tem permissão de Editor na pasta ${mainFolderId}. Erro: ${folderError.message}`,
      );
    }

    // 4. Upload do Arquivo
    console.log(`[Drive] Uploading arquivo: ${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [subFolderId],
      },
      media: {
        mimeType: file.type,
        body: bufferStream,
      },
      fields: "id, webViewLink, webContentLink",
    });

    // 5. Permissões (Público para quem tem o link)
    await drive.permissions.create({
      fileId: uploadedFile.data.id!,
      requestBody: { role: "reader", type: "anyone" },
    });

    const contratoUrl = uploadedFile.data.webViewLink;
    console.log(`[Sucesso] Link gerado: ${contratoUrl}`);

    // 6. Atualizar Banco
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { error: dbError } = await supabaseClient
      .from("empresas")
      .update({ contrato_url: contratoUrl })
      .eq("id", empresaId);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ message: "Sucesso", url: contratoUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[Erro Fatal]", error);
    return new Response(JSON.stringify({ error: `Erro no servidor: ${error.message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
