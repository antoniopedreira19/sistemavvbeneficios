import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { google } from "https://esm.sh/googleapis@126.0.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    console.log('Autenticação Google realizada com sucesso')

    // 2. Buscar ou Criar a Pasta Mãe "CONTRATOS VV BENEFÍCIOS"
    const MAIN_FOLDER_NAME = 'CONTRATOS VV BENEFÍCIOS'
    let mainFolderId = ''
    
    const mainFolderSearch = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${MAIN_FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
    })

    if (mainFolderSearch.data.files && mainFolderSearch.data.files.length > 0) {
      mainFolderId = mainFolderSearch.data.files[0].id!
      console.log(`Pasta raiz encontrada: ${mainFolderId}`)
    } else {
      console.log(`Criando pasta raiz: ${MAIN_FOLDER_NAME}`)
      const folder = await drive.files.create({
        requestBody: {
          name: MAIN_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      })
      mainFolderId = folder.data.id!
      console.log(`Pasta raiz criada: ${mainFolderId}`)
    }

    // 3. Buscar ou Criar a Subpasta da Empresa DENTRO da Pasta Mãe
    const subFolderName = `CONTRATO_${empresaNome.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
    let subFolderId = ''

    const subFolderSearch = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${subFolderName}' and '${mainFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    })

    if (subFolderSearch.data.files && subFolderSearch.data.files.length > 0) {
      subFolderId = subFolderSearch.data.files[0].id!
      console.log(`Subpasta encontrada: ${subFolderId}`)
    } else {
      console.log(`Criando subpasta: ${subFolderName}`)
      const folder = await drive.files.create({
        requestBody: {
          name: subFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mainFolderId],
        },
        fields: 'id',
      })
      subFolderId = folder.data.id!
      console.log(`Subpasta criada: ${subFolderId}`)
    }

    // 4. Upload do Arquivo
    console.log(`Fazendo upload do arquivo: ${file.name}`)
    const arrayBuffer = await file.arrayBuffer()
    
    // Criar readable stream a partir do buffer
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(arrayBuffer))
        controller.close()
      }
    })

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [subFolderId],
      },
      media: {
        mimeType: file.type,
        body: readable,
      },
      fields: 'id, webViewLink',
    })

    console.log(`Arquivo uploaded: ${uploadedFile.data.id}`)

    // 5. Configurar Permissões (público com link)
    await drive.permissions.create({
      fileId: uploadedFile.data.id!,
      requestBody: { 
        role: 'reader', 
        type: 'anyone' 
      },
    })

    const contratoUrl = uploadedFile.data.webViewLink
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
        url: contratoUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Erro no upload:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})
