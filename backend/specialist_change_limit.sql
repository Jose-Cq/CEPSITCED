-- 1. Agregar columna de comentarios de cambio en la tabla de citas (exclusivo para el cambio opcional de la 3ra cita)
ALTER TABLE public.citas 
ADD COLUMN IF NOT EXISTS comentario_cambio_psicologo text;

-- 2. Crear la tabla de auditoría cambio_psicologo (con nombre corto y estados capitalizados)
CREATE TABLE IF NOT EXISTS public.cambio_psicologo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cita_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  servicio character varying NOT NULL,
  psicologo_anterior_id uuid,
  psicologo_nuevo_id uuid NOT NULL,
  motivo text NOT NULL,
  estado character varying NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cambio_psicologo_pkey PRIMARY KEY (id),
  CONSTRAINT cambio_psicologo_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id) ON DELETE CASCADE,
  CONSTRAINT cambio_psicologo_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
  CONSTRAINT cambio_psicologo_psicologo_anterior_fkey FOREIGN KEY (psicologo_anterior_id) REFERENCES public.empleados(id),
  CONSTRAINT cambio_psicologo_psicologo_nuevo_fkey FOREIGN KEY (psicologo_nuevo_id) REFERENCES public.empleados(id)
);
