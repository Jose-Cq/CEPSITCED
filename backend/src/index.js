import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rutas
import landingRoutes from './routes/landing.js';
import serviciosRoutes from './routes/servicios.js';
import especialistasRoutes from './routes/especialistas.js';
import pacientesRoutes from './routes/pacientes.js';
import citasRoutes from './routes/citas.js';
import pagosRoutes from './routes/pagos.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middlewares globales
app.use(cors());
app.use(express.json());

// Endpoint raíz para comprobar estado de la API
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'La API del sistema CEPSITCED está en línea.',
    timestamp: new Date().toISOString()
  });
});

// Montar rutas de la API bajo /api
app.use('/api/landing', landingRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/especialistas', especialistasRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/pagos', pagosRoutes);

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('Error global del servidor:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de API corriendo en http://localhost:${PORT}`);
});

export default app;
