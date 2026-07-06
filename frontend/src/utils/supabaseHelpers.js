// Compatibility layer re-exporting backend services to avoid breaking existing frontend code.

export {
  iniciarSesion,
  cerrarSesion,
  obtenerPerfilActual,
  registrarPaciente,
  obtenerPacienteActual,
  actualizarPaciente,
  obtenerPacientesAsociados,
  obtenerDocumentosPaciente,
  obtenerEmpleados,
  registrarPacienteConsolidado,
  recuperarAcceso,
  verificarTokenIndependizacion,
  completarIndependizacion
} from '@backend/services/pacientesService.js';

export {
  obtenerCitasPaciente,
  crearCita,
  cancelarCita
} from '@backend/services/citasService.js';

export {
  obtenerLocalesActivos
} from '@backend/services/serviciosService.js';

export {
  obtenerMetodosPagoClinica
} from '@backend/services/pagosService.js';