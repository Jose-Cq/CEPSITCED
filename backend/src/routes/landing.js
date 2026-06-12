import express from 'express';
import { getCarrusel, getConfiguracion, getTestimonios } from '../controllers/landingController.js';

const router = express.Router();

router.get('/carousel', getCarrusel);
router.get('/configuracion', getConfiguracion);
router.get('/testimonios', getTestimonios);

export default router;
