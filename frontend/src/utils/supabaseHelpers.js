// Compatibility layer re-exporting backend services to avoid breaking existing frontend code.

export {
  iniciarSesion,
  cerrarSesion,
  obtenerUltimoNumeroHC,
  registrarPerfil,
  obtenerPerfilActual,
  verificarDuplicadoDNI,
  registrarPaciente,
  obtenerPacienteActual,
  actualizarPaciente,
  obtenerPacientesAsociados,
  obtenerApoderados,
  obtenerDocumentosPaciente,
  obtenerEmpleados
} from '@backend/services/pacientesService.js';

export {
  obtenerCitasPaciente,
  crearCita,
  obtenerCitasDelDia,
  obtenerPsicologasPorServicio,
  obtenerHorariosPsicologas,
  obtenerCitasPsicologa,
  obtenerHabitacionesPorLocal,
  cancelarCita
} from '@backend/services/citasService.js';

export {
  obtenerLocalesActivos,
  obtenerServicios,
  obtenerPaquetes
} from '@backend/services/serviciosService.js';

export {
  obtenerMetodosPagoClinica
} from '@backend/services/pagosService.js';