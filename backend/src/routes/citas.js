import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getCitasPaciente,
  postCrearCita,
  getCitasDelDia,
  getPsicologasPorServicio,
  getHorariosPsicologas,
  getCitasPsicologa,
  getHabitacionesPorLocal,
  putCancelarCita
} from '../controllers/citasController.js';

const router = express.Router();

// Scheduling information (publicly readable)
router.get('/dia', getCitasDelDia);
router.get('/psicologas-servicio/:servicioId', getPsicologasPorServicio);
router.get('/horarios-psicologas', getHorariosPsicologas);
router.get('/citas-psicologa', getCitasPsicologa);
router.get('/habitaciones/:localId', getHabitacionesPorLocal);

// Appointment creation and management (requires login)
router.get('/paciente/:pacienteId', requireAuth, getCitasPaciente);
router.post('/', requireAuth, postCrearCita);
router.put('/:id/cancelar', requireAuth, putCancelarCita);

export default router;
