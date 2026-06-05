import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const usePacienteActual = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [perfilUsuario, setPerfilUsuario] = useState(null); // perfiles table record
  const [perfilClinicoPropio, setPerfilClinicoPropio] = useState(null); // pacientes table where id_perfil_propio = user.id
  const [perfilesDependientes, setPerfilesDependientes] = useState([]); // pacientes table where id_apoderado = user.id

  const cargarDatos = useCallback(async (retryCount = 0) => {
    let isRetrying = false;
    try {
      setError(null);

      // 1. Esperar a que la sesión esté lista
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        setPerfilUsuario(null);
        setPerfilClinicoPropio(null);
        setPerfilesDependientes([]);
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // 2. Consulta 1: Obtener el perfil de la cuenta de usuario (perfiles)
      const { data: perfilAcc, error: errPerfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (errPerfil) throw errPerfil;

      // Si por retraso de sincronización tras registro no encuentra el perfil, reintentar
      if (!perfilAcc && retryCount < 3) {
        console.log(`Perfil de cuenta no encontrado en Supabase. Reintentando... (${retryCount + 1}/3)`);
        isRetrying = true;
        setTimeout(() => cargarDatos(retryCount + 1), 1000);
        return;
      }

      setPerfilUsuario(perfilAcc);

      // 3. Consulta 2: Obtener el registro clínico propio del usuario (pacientes)
      const { data: clinicoPropio, error: errClinico } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id_perfil_propio', userId)
        .maybeSingle();

      if (errClinico) throw errClinico;
      setPerfilClinicoPropio(clinicoPropio);

      // 4. Consulta 3: Obtener los perfiles dependientes/familiares (pacientes)
      const { data: dependientes, error: errDependientes } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id_apoderado', userId)
        .is('id_perfil_propio', null);

      if (errDependientes) throw errDependientes;
      setPerfilesDependientes(dependientes || []);

      // 5. Validar que exista al menos algún registro clínico (propio o dependientes)
      // Si la carga terminó y no hay ningún registro en pacientes, lanzar el mensaje específico
      if (!clinicoPropio && (!dependientes || dependientes.length === 0)) {
        // Solo lanzar error si ya no estamos en reintentos
        if (retryCount >= 3 || (!perfilAcc)) {
          setError("No se encontró tu perfil de paciente");
        } else {
          // Reintentar una vez más
          isRetrying = true;
          setTimeout(() => cargarDatos(retryCount + 1), 1000);
          return;
        }
      }

    } catch (err) {
      console.error("Error en usePacienteActual:", err);
      // No mostrar error en UI si estamos en proceso de carga inicial o reintentando
      if (retryCount >= 3) {
        setError(err.message || "Error al cargar los perfiles");
      }
    } finally {
      if (!isRetrying) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const refetch = useCallback(() => {
    setLoading(true);
    cargarDatos();
  }, [cargarDatos]);

  return {
    loading,
    error,
    perfilUsuario,
    perfilClinicoPropio,
    perfilesDependientes,
    refetch
  };
};
