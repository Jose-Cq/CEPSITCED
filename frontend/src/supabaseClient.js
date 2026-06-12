import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const cleanString = (val) => {
  if (!val) return null
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null
  return trimmed
}

const supabaseUrl = cleanString(rawUrl) || 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = cleanString(rawKey) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

console.log('--- Supabase Connection Status ---')
console.log('URL Supabase configurada:', !!cleanString(rawUrl))
console.log('KEY Supabase configurada:', !!cleanString(rawKey))
if (!cleanString(rawUrl) || !cleanString(rawKey)) {
  console.warn('Usando valores de fallback predeterminados para Supabase.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)