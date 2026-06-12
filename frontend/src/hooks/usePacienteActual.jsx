import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { obtenerPerfilActual, obtenerPacienteActual, obtenerPacientesAsociados } from '../utils/supabaseHelpers';

const PacienteContext = createContext(null);

export const PacienteProvider = ({ children }) => {
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

      // 2. Consulta 1: Obtener el perfil de la cuenta de usuario (perfiles) desde la API
      const resPerfil = await obtenerPerfilActual();
      if (!resPerfil.success) throw new Error(resPerfil.error);
      const perfilAcc = resPerfil.data;

      // Si por retraso de sincronización tras registro no encuentra el perfil, reintentar
      if (!perfilAcc && retryCount < 3) {
        console.log(`Perfil de cuenta no encontrado en la API. Reintentando... (${retryCount + 1}/3)`);
        isRetrying = true;
        setTimeout(() => cargarDatos(retryCount + 1), 1000);
        return;
      }

      setPerfilUsuario(perfilAcc);

      // 3. Consulta 2: Obtener el registro clínico propio del usuario (pacientes) desde la API
      const resClinico = await obtenerPacienteActual();
      if (!resClinico.success) throw new Error(resClinico.error);
      const clinicoPropio = resClinico.data;
      setPerfilClinicoPropio(clinicoPropio);

      // 4. Consulta 3: Obtener los perfiles dependientes/familiares (pacientes) desde la API
      const resDependientes = await obtenerPacientesAsociados();
      if (!resDependientes.success) throw new Error(resDependientes.error);
      const dependientesCompleto = resDependientes.data || [];
      // Filtrar dependientes reales (id_perfil_propio es nulo)
      const dependientes = dependientesCompleto.filter(d => !d.id_perfil_propio);
      setPerfilesDependientes(dependientes);

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

  return (
    <PacienteContext.Provider
      value={{
        loading,
        error,
        perfilUsuario,
        perfilClinicoPropio,
        perfilesDependientes,
        refetch
      }}
    >
      {children}
    </PacienteContext.Provider>
  );
};

export const usePacienteActual = () => {
  const context = useContext(PacienteContext);
  if (!context) {
    throw new Error('usePacienteActual debe usarse dentro de un PacienteProvider');
  }
  return context;
};
