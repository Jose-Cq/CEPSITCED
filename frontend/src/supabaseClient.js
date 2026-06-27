import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const cleanString = (val) => {
  if (!val) return null
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null
  return trimmed
}

const supabaseUrl = cleanString(rawUrl)
const supabaseAnonKey = cleanString(rawKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Error crítico: No se encontraron las variables de entorno de Supabase (VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY) en el frontend.'
  )
}

console.log('--- Supabase Connection Status ---')
console.log('URL Supabase configurada correctamente a través de variables de entorno.')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
