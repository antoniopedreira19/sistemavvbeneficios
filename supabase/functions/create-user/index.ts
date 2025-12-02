import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('create-user function called')

  try {
    // Parse request body
    let body
    try {
      body = await req.json()
      console.log('Request body parsed:', { ...body, password: '[REDACTED]' })
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { email, password, nome, empresa_id, role } = body

    // Validate input
    if (!email || !password || !nome || !role) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Email, senha, nome e role são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!['admin', 'cliente', 'operacional', 'financeiro'].includes(role)) {
      console.error('Invalid role:', role)
      return new Response(
        JSON.stringify({ error: 'Role inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (role === 'cliente' && !empresa_id) {
      console.error('Missing empresa_id for cliente role')
      return new Response(
        JSON.stringify({ error: 'Empresa é obrigatória para usuários cliente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the calling user's role
    const authHeader = req.headers.get('authorization')
    let callerRole = null
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const supabaseUser = createClient(supabaseUrl, supabaseServiceKey)
      const { data: { user } } = await supabaseUser.auth.getUser(token)
      
      if (user) {
        const { data: roleData } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        callerRole = roleData?.role
      }
    }

    // Validate: operacional users cannot create admin users
    if (callerRole === 'operacional' && role === 'admin') {
      console.error('Operacional user tried to create admin user')
      return new Response(
        JSON.stringify({ error: 'Usuários operacionais não podem criar administradores' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log('Creating user in auth...')
    
    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome }
    })

    if (authError) {
      console.error('Auth error:', authError)
      
      // Handle duplicate email specifically
      if (authError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este e-mail já está cadastrado no sistema' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!authData.user) {
      console.error('No user data returned from auth')
      return new Response(
        JSON.stringify({ error: 'Falha ao criar usuário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('User created in auth, id:', authData.user.id)

    // Update or insert profile (upsert)
    console.log('Upserting profile...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        nome,
        email,
        empresa_id: role === 'cliente' ? empresa_id : null
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      throw new Error(`Failed to create profile: ${profileError.message}`)
    }

    console.log('Profile created')

    // Insert into user_roles (upsert to avoid conflicts)
    console.log('Upserting user role...')
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authData.user.id,
        role
      }, {
        onConflict: 'user_id,role'
      })

    if (roleError) {
      console.error('Role error:', roleError)
      throw new Error(`Failed to create user role: ${roleError.message}`)
    }

    console.log('User role created successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ 
        error: message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
