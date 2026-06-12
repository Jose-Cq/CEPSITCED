import express from 'express';
import { getEspecialistasLanding } from '../controllers/especialistasController.js';

const router = express.Router();

router.get('/landing', getEspecialistasLanding);

export default router;
