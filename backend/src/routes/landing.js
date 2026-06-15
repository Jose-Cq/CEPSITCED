import express from 'express';
import { getCarrusel, getConfiguracion, getTestimonios, getFaq } from '../controllers/landingController.js';

const router = express.Router();

router.get('/carousel', getCarrusel);
router.get('/configuracion', getConfiguracion);
router.get('/testimonios', getTestimonios);
router.get('/faq', getFaq);

export default router;

