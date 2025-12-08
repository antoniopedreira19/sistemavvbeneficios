import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para converter para base64url
function base64url(data: Uint8Array): string {
  return base64Encode(data.buffer as ArrayBuffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Função para criar JWT para Service Account do Google
async function createGoogleJWT(credentials: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const signatureInput = `${encodedHeader}.${encodedPayload}`

  // Importar a chave privada
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  )

  const encodedSignature = base64url(new Uint8Array(signature))
  return `${signatureInput}.${encodedSignature}`
}

// Função para obter access token do Google
async function getGoogleAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createGoogleJWT(credentials)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Falha na autenticação Google: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

// Função para buscar pasta por nome (suporta Shared Drives)
async function findFolder(accessToken: string, name: string, parentId?: string): Promise<string | null> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`
  if (parentId) {
    query += ` and '${parentId}' in parents`
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro ao buscar pasta: ${errorText}`)
  }

  const data = await response.json()
  return data.files && data.files.length > 0 ? data.files[0].id : null
}

// Função para criar pasta (suporta Shared Drives)
async function createFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) {
    metadata.parents = [parentId]
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro ao criar pasta: ${errorText}`)
  }

  const data = await response.json()
  return data.id
}

// Função para upload de arquivo (suporta Shared Drives)
async function uploadFile(
  accessToken: string,
  fileName: string,
  fileContent: ArrayBuffer,
  mimeType: string,
  parentId: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [parentId],
  }

  // Usar multipart upload
  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
  const contentPart = `${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`

  const base64Content = btoa(
    new Uint8Array(fileContent).reduce((data, byte) => data + String.fromCharCode(byte), '')
  )

  const multipartBody = metadataPart + contentPart + base64Content + closeDelimiter

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro ao fazer upload: ${errorText}`)
  }

  return await response.json()
}

// Função para definir permissões (suporta Shared Drives)
async function setPublicPermission(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.warn(`Aviso ao definir permissões: ${errorText}`)
    // Não lançar erro pois em Shared Drives as permissões podem ser herdadas
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Iniciando upload de contrato...')

    const formData = await req.formData()
    const file = formData.get('file') as File
    const empresaId = formData.get('empresaId') as string
    const empresaNome = formData.get('empresaNome') as string

    if (!file || !empresaId || !empresaNome) {
      throw new Error('Arquivo, ID da empresa e Nome são obrigatórios')
    }

    console.log(`Processando arquivo: ${file.name} para empresa: ${empresaNome} (${empresaId})`)

    // 1. Autenticação Google
    const credentialsJson = Deno.env.get('GOOGLE_CREDENTIALS')
    if (!credentialsJson) {
      throw new Error('GOOGLE_CREDENTIALS não configurada')
    }

    const credentials = JSON.parse(credentialsJson)
    const accessToken = await getGoogleAccessToken(credentials)
    console.log('Autenticação Google realizada com sucesso')

    // 2. Usar a pasta raiz configurada via env
    const mainFolderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')
    if (!mainFolderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID não configurada')
    }
    console.log(`Usando pasta raiz: ${mainFolderId}`)

    // 3. Buscar ou Criar a Subpasta da Empresa dentro da pasta compartilhada
    const subFolderName = `CONTRATO_${empresaNome.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
    let subFolderId = await findFolder(accessToken, subFolderName, mainFolderId)

    if (!subFolderId) {
      console.log(`Criando subpasta: ${subFolderName}`)
      subFolderId = await createFolder(accessToken, subFolderName, mainFolderId)
    }
    console.log(`Subpasta: ${subFolderId}`)

    // 4. Upload do Arquivo
    console.log(`Fazendo upload do arquivo: ${file.name}`)
    const arrayBuffer = await file.arrayBuffer()
    const uploadedFile = await uploadFile(accessToken, file.name, arrayBuffer, file.type, subFolderId)
    console.log(`Arquivo uploaded: ${uploadedFile.id}`)

    // 5. Configurar Permissões (público com link)
    await setPublicPermission(accessToken, uploadedFile.id)
    console.log(`Permissões configuradas`)

    const contratoUrl = uploadedFile.webViewLink
    console.log(`URL do contrato: ${contratoUrl}`)

    // 6. Atualizar Banco de Dados
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabaseClient
      .from('empresas')
      .update({ contrato_url: contratoUrl })
      .eq('id', empresaId)

    if (dbError) {
      console.error('Erro ao atualizar banco:', dbError)
      throw dbError
    }

    console.log('Contrato salvo com sucesso!')

    return new Response(
      JSON.stringify({
        message: 'Upload realizado com sucesso',
        url: contratoUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    console.error('Erro no upload:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})