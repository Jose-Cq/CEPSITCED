-- Migration: Phase 1 & 3 authentication flow adjustments

-- 1. Agregar columna 'activo' a la tabla perfiles
ALTER TABLE public.perfiles
ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

-- 2. Crear la tabla tokens_verificacion
CREATE TABLE IF NOT EXISTS public.tokens_verificacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL,
  token_hash character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  expira_en timestamp with time zone NOT NULL,
  CONSTRAINT tokens_verificacion_pkey PRIMARY KEY (id),
  CONSTRAINT tv_perfil_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfiles(id) ON DELETE CASCADE
);

-- 3. Crear la tabla tokens_independizacion
CREATE TABLE IF NOT EXISTS public.tokens_independizacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  token_hash character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  expira_en timestamp with time zone NOT NULL,
  CONSTRAINT tokens_independizacion_pkey PRIMARY KEY (id),
  CONSTRAINT ti_paciente_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE
);

-- 4. Habilitar seguridad a nivel de filas (RLS)
ALTER TABLE public.tokens_verificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_independizacion ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS permitiendo operaciones a service_role, authenticated y anon
-- Almacenamos únicamente hashes SHA-256 criptográficos de un solo sentido, lo cual garantiza que los tokens planos nunca se guarden en texto claro ni se expongan.

-- POLÍTICAS PARA TOKENS DE VERIFICACIÓN (FASE 1)
CREATE POLICY "Permitir inserción de tokens de verificación" 
ON public.tokens_verificacion
FOR INSERT 
TO anon, authenticated, service_role
WITH CHECK (true);

CREATE POLICY "Permitir lectura de tokens de verificación" 
ON public.tokens_verificacion
FOR SELECT 
TO anon, authenticated, service_role
USING (true);

CREATE POLICY "Permitir eliminación de tokens de verificación" 
ON public.tokens_verificacion
FOR DELETE 
TO anon, authenticated, service_role
USING (true);

-- POLÍTICAS PARA TOKENS DE INDEPENDIZACIÓN (FASE 3)
CREATE POLICY "Permitir inserción de tokens de independizacion" 
ON public.tokens_independizacion
FOR INSERT 
TO anon, authenticated, service_role
WITH CHECK (true);

CREATE POLICY "Permitir lectura de tokens de independizacion" 
ON public.tokens_independizacion
FOR SELECT 
TO anon, authenticated, service_role
USING (true);

CREATE POLICY "Permitir eliminación de tokens de independizacion" 
ON public.tokens_independizacion
FOR DELETE 
TO anon, authenticated, service_role
USING (true);
