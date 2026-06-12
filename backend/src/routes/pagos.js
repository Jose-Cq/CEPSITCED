import express from 'express';
import { getMetodosPagoClinica } from '../controllers/pagosController.js';

const router = express.Router();

router.get('/metodos', getMetodosPagoClinica);

export default router;
