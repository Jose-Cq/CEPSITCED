-- 1. Crear tabla metodos_pago_clinica
CREATE TABLE IF NOT EXISTS public.metodos_pago_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo varchar NOT NULL CHECK (tipo IN ('TRANSFERENCIA', 'YAPE')),
  banco varchar,
  moneda varchar DEFAULT 'Soles',
  numero_cuenta varchar,
  cci varchar,
  titular varchar NOT NULL,
  numero_yape varchar,
  qr_url text,
  telefono_confirmacion varchar,
  mensaje_confirmacion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Activar RLS en la tabla
ALTER TABLE public.metodos_pago_clinica ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir la lectura de métodos de pago activos a usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura de metodos de pago activos a usuarios autenticados" ON public.metodos_pago_clinica;
CREATE POLICY "Permitir lectura de metodos de pago activos a usuarios autenticados"
ON public.metodos_pago_clinica
FOR SELECT
TO authenticated
USING (activo = true);

-- 4. Insertar registros de BCP y Yape si no existen
INSERT INTO public.metodos_pago_clinica (
  tipo, banco, moneda, numero_cuenta, cci, titular, telefono_confirmacion, mensaje_confirmacion, activo
)
SELECT 
  'TRANSFERENCIA', 'BCP', 'Soles', '19134627591062', '00219113462759106254', 'Dra. Milagros Ordinola Villegas', '992722491', 
  'Realiza el depósito usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.metodos_pago_clinica 
  WHERE tipo = 'TRANSFERENCIA' AND numero_cuenta = '19134627591062'
);

INSERT INTO public.metodos_pago_clinica (
  tipo, moneda, titular, numero_yape, qr_url, telefono_confirmacion, mensaje_confirmacion, activo
)
SELECT 
  'YAPE', 'Soles', 'Dra. Milagros Ordinola Villegas', '992722491', null, '992722491', 
  'Realiza el yapeo usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.metodos_pago_clinica 
  WHERE tipo = 'YAPE' AND numero_yape = '992722491'
);
