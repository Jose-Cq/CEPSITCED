import express from 'express';
import { getLocalesActivos, getServiciosLandingPorLocal, getServicios, getPaquetes, getReglasPrecios, getCuponByCodigo, usarCupon } from '../controllers/serviciosController.js';

const router = express.Router();

router.get('/locales', getLocalesActivos);
router.get('/landing', getServiciosLandingPorLocal);
router.get('/reglas-precios', getReglasPrecios);
router.get('/cupon/:codigo', getCuponByCodigo);
router.post('/cupon/usar', usarCupon);
router.get('/', getServicios);
router.get('/:id/paquetes', getPaquetes);

export default router;
