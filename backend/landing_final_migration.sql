-- =========================================================================
-- SCRIPT DE MIGRACIÓN FINAL Y CONSOLIDADO PARA EL LANDING PAGE DE CEPSITCED
-- =========================================================================

-- 1. REESTRUCTURAR 'landing_configuracion' (Interruptores booleanos de secciones)
DROP TABLE IF EXISTS public.landing_configuracion CASCADE;

CREATE TABLE public.landing_configuracion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mostrar_nosotros boolean DEFAULT true,
  mostrar_personal boolean DEFAULT true,
  mostrar_testimonios boolean DEFAULT true,
  mostrar_faq boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT landing_configuracion_pkey PRIMARY KEY (id)
);

-- Habilitar RLS
ALTER TABLE public.landing_configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para 'landing_configuracion'
CREATE POLICY "Permitir select público de landing_configuracion" 
ON public.landing_configuracion FOR SELECT USING (true);

CREATE POLICY "Permitir gestión completa de landing_configuracion" 
ON public.landing_configuracion FOR ALL USING (true) WITH CHECK (true);


-- 2. REESTRUCTURAR 'landing_nosotros' (Contenido institucional)
DROP TABLE IF EXISTS public.landing_nosotros CASCADE;

CREATE TABLE public.landing_nosotros (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mision_subtitulo character varying DEFAULT 'Comprometidos con tu bienestar emocional'::character varying,
  mision_texto text DEFAULT 'Ofrecer y brindar servicios psicológicos dirigidos a estudiantes, instituciones y comunidades, promoviendo la salud mental en nuestra sociedad a través de una atención responsable, ética y comprometida con el bienestar de los pacientes en todas las áreas.'::text,
  vision_subtitulo character varying DEFAULT 'Líderes en salud mental y desarrollo humano'::character varying,
  vision_texto text DEFAULT 'Ser una institución destacada y reconocida en el ámbito de la salud mental y el apoyo a instituciones educativas, contribuyendo a la prevención, promoción e intervención psicológica con calidad humana, ética profesional y compromiso social.'::text,
  imagen_url text DEFAULT 'https://placehold.co/600x400/007bff/ffffff?text=CEPSITCED+Nosotros'::text,
  creado_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT landing_nosotros_pkey PRIMARY KEY (id)
);

-- Habilitar RLS
ALTER TABLE public.landing_nosotros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para 'landing_nosotros'
CREATE POLICY "Permitir select público de landing_nosotros" 
ON public.landing_nosotros FOR SELECT USING (true);

CREATE POLICY "Permitir gestión completa de landing_nosotros" 
ON public.landing_nosotros FOR ALL USING (true) WITH CHECK (true);


-- 3. LIMPIEZA DE LA TABLA 'landing_carousel'
-- Eliminamos definitivamente las columnas redundantes 'boton_texto' y 'boton_accion'
ALTER TABLE public.landing_carousel DROP COLUMN IF EXISTS boton_texto;
ALTER TABLE public.landing_carousel DROP COLUMN IF EXISTS boton_accion;


-- 4. INSERT DE DATOS SEMILLA (Fila inicial por defecto)
INSERT INTO public.landing_configuracion (mostrar_nosotros, mostrar_personal, mostrar_testimonios, mostrar_faq)
VALUES (true, true, true, true);

INSERT INTO public.landing_nosotros (mision_subtitulo, mision_texto, vision_subtitulo, vision_texto, imagen_url)
VALUES (
  'Comprometidos con tu bienestar emocional',
  'Ofrecer y brindar servicios psicológicos dirigidos a estudiantes, instituciones y comunidades, promoviendo la salud mental en nuestra sociedad a través de una atención responsable, ética y comprometida con el bienestar de los pacientes en todas las áreas.',
  'Líderes en salud mental y desarrollo humano',
  'Ser una institución destacada y reconocida en el ámbito de la salud mental y el apoyo a instituciones educativas, contribuyendo a la prevención, promoción e intervención psicológica con calidad humana, ética profesional y compromiso social.',
  'https://placehold.co/600x400/007bff/ffffff?text=CEPSITCED+Nosotros'
);
