-- Migration: Add tipo_pago column to public.citas table
ALTER TABLE public.citas
ADD COLUMN IF NOT EXISTS tipo_pago character varying;
