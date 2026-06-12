import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  login,
  getUltimoNumeroHC,
  getVerificarDuplicadoDNI,
  postRegistrarPerfil,
  getPerfilActual,
  postRegistrarPaciente,
  getPacienteActual,
  putActualizarPaciente,
  getPacientesAsociados,
  getDocumentosPaciente,
  getEmpleados
} from '../controllers/pacientesController.js';

const router = express.Router();

// Public routes
router.post('/iniciar-sesion', login);
router.get('/ultimo-hc', getUltimoNumeroHC);
router.get('/verificar-dni', getVerificarDuplicadoDNI);

// Protected routes (require valid session token)
router.post('/perfil', requireAuth, postRegistrarPerfil);
router.get('/perfil/actual', requireAuth, getPerfilActual);
router.post('/', requireAuth, postRegistrarPaciente);
router.get('/actual', requireAuth, getPacienteActual);
router.put('/:id', requireAuth, putActualizarPaciente);
router.get('/asociados', requireAuth, getPacientesAsociados);
router.get('/:id/documentos', requireAuth, getDocumentosPaciente);
router.get('/empleados', requireAuth, getEmpleados);

export default router;
