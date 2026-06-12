import express from 'express';
import { getLocalesActivos, getServiciosLandingPorLocal, getServicios, getPaquetes } from '../controllers/serviciosController.js';

const router = express.Router();

router.get('/locales', getLocalesActivos);
router.get('/landing', getServiciosLandingPorLocal);
router.get('/', getServicios);
router.get('/:id/paquetes', getPaquetes);

export default router;
