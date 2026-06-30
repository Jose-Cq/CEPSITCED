import express from 'express';
import { getCarrusel, getConfiguracion, getTestimonios, getFaq, getMisionVision, updateConfiguracion, updateNosotros } from '../controllers/landingController.js';

const router = express.Router();

router.get('/carousel', getCarrusel);
router.get('/configuracion', getConfiguracion);
router.put('/configuracion', updateConfiguracion);
router.get('/testimonios', getTestimonios);
router.get('/faq', getFaq);
router.get('/mision-vision', getMisionVision);
router.put('/mision-vision', updateNosotros);

export default router;

