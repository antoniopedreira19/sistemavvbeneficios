import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Get access token using JWT
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Base64URL encode
    const base64url = (str: string) => 
      btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signInput = `${encodedHeader}.${encodedPayload}`;

    // Import private key and sign
    const pemKey = credentials.private_key;
    const pemContents = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "");
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signInput)
    );
    
    const encodedSignature = base64url(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = `${signInput}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      throw new Error(`Erro ao obter token: ${tokenError}`);
    }

    const { access_token } = await tokenResponse.json();

    // ID da pasta 'CONTRATOS_GERAL_VV'
    const mainFolderId = "1h7PizLVrRJIOfPrGPCfysecIqjewfiXe";
    console.log(`[Drive] Usando pasta raiz fixa: ${mainFolderId}`);

    // 3. Buscar ou Criar a Subpasta da Empresa
    const subFolderName = `CONTRATO_${empresaNome.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    let subFolderId = "";

    // Procura subpasta DENTRO da pasta raiz fixa
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${subFolderName}' and '${mainFolderId}' in parents and trashed=false`
    )}&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!searchResponse.ok) {
      throw new Error(`Erro ao buscar pasta: ${await searchResponse.text()}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      subFolderId = searchData.files[0].id;
      console.log(`[Drive] Subpasta encontrada: ${subFolderId}`);
    } else {
      console.log(`[Drive] Criando subpasta: ${subFolderName}`);
      
      const createFolderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: subFolderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [mainFolderId],
        }),
      });

      if (!createFolderResponse.ok) {
        throw new Error(`Erro ao criar pasta: ${await createFolderResponse.text()}`);
      }

      const folderData = await createFolderResponse.json();
      subFolderId = folderData.id;
    }

    // 4. Upload do Arquivo usando multipart upload
    console.log(`[Drive] Uploading arquivo: ${file.name}`);
    
    const metadata = {
      name: file.name,
      parents: [subFolderId],
    };

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    
    const boundary = "boundary_" + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaPart = `Content-Type: ${file.type}\r\n\r\n`;

    const encoder = new TextEncoder();
    const parts = [
      encoder.encode(delimiter),
      encoder.encode(metadataPart),
      encoder.encode(delimiter),
      encoder.encode(mediaPart),
      fileBytes,
      encoder.encode(closeDelimiter),
    ];

    const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Erro no upload: ${await uploadResponse.text()}`);
    }

    const uploadedFile = await uploadResponse.json();

    // 5. Permissões (Público para quem tem o link)
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    const contratoUrl = uploadedFile.webViewLink;
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
