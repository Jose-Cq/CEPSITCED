-- =========================================================================
-- TRIGGER: check_package_consumption
-- DESCRIPTION: Automatically deletes the package from public.paquetes_adquiridos
--              when all sessions are consumed (sesiones_disponibles = 0)
--              and the session status updates to completed/attended.
-- =========================================================================

CREATE OR REPLACE FUNCTION check_package_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- If the appointment state is updated to Atendido, Realizada or Completada
  IF (NEW.estado_cita = 'Atendido' OR NEW.estado_cita = 'Realizada' OR NEW.estado_cita = 'Completada') 
     AND NEW.paquete_id IS NOT NULL THEN
     
     -- Check if the package's sessions available is 0
     IF EXISTS (
       SELECT 1 FROM public.paquetes_adquiridos 
       WHERE id = NEW.paquete_id AND sesiones_disponibles = 0
     ) THEN
       -- Delete the package from active acquisitions
       DELETE FROM public.paquetes_adquiridos WHERE id = NEW.paquete_id;
     END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists to avoid duplication
DROP TRIGGER IF EXISTS trg_check_package_consumption ON public.citas;

-- Create the trigger
CREATE TRIGGER trg_check_package_consumption
AFTER UPDATE OF estado_cita ON public.citas
FOR EACH ROW
EXECUTE FUNCTION check_package_consumption();
