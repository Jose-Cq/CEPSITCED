import express from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { verifyToken, generateToken } from '../utils/cryptoToken.js';

const router = express.Router();

const renderMessagePage = (title, subtitle, message, isSuccess, buttonLink = null, buttonText = null) => {
  const primaryColor = isSuccess ? '#10b981' : '#ef4444'; 
  const shadowColor = isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  const icon = isSuccess ? 'check_circle' : 'cancel';
  const fontUrl = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap";

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - CEPSITCED</title>
      <link href="${fontUrl}" rel="stylesheet">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0" />
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          background: radial-gradient(circle at 10% 20%, rgba(0, 49, 120, 0.05) 0%, rgba(108, 189, 254, 0.03) 90.1%), #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #1e293b;
        }
        .container {
          background: #ffffff;
          max-width: 480px;
          width: 100%;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          padding: 40px 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(90deg, #003178 0%, #6cbdfe 100%);
        }
        .icon-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: ${shadowColor};
          color: ${primaryColor};
          margin-bottom: 24px;
        }
        .icon-container .material-symbols-outlined {
          font-size: 48px;
        }
        h1 {
          font-size: 24px;
          font-weight: 800;
          color: #003178;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 20px;
        }
        p {
          font-size: 15px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          background-color: #003178;
          color: #ffffff;
          padding: 14px 28px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 12px;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 4px 6px -1px rgba(0, 49, 120, 0.15);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .btn:hover {
          background-color: #002354;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 49, 120, 0.2);
        }
        .btn:active {
          transform: translateY(0);
        }
        .footer {
          margin-top: 30px;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-container">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <h1>CEPSITCED</h1>
        <div class="subtitle">${subtitle}</div>
        <p>${message}</p>
        ${buttonLink && buttonText ? `<a href="${buttonLink}" class="btn">${buttonText}</a>` : ''}
        <div class="footer">
          Este es un servicio seguro provisto por CEPSITCED. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
  `;
};

// GET /api/auth/confirmar-cuenta/:token
router.get('/confirmar-cuenta/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).send(renderMessagePage('Error', 'Token Inválido', 'No se ha provisto ningún token de activación.', false));
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    // Buscar en la tabla tokens_verificacion
    const { data: record, error: findError } = await supabase
      .from('tokens_verificacion')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expira_en', now)
      .maybeSingle();

    if (findError || !record) {
      return res.status(400).send(renderMessagePage('Enlace Expirado', 'Verificación Fallida', 'El enlace de verificación es inválido, ha expirado (límite de 24 horas) o ya ha sido utilizado.', false));
    }

    // Activar el perfil
    const { error: updateError } = await supabase
      .from('perfiles')
      .update({ activo: true })
      .eq('id', record.perfil_id);

    if (updateError) {
      throw updateError;
    }

    // Eliminar el token
    await supabase
      .from('tokens_verificacion')
      .delete()
      .eq('id', record.id);

    const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://cepsitced.vercel.app';

    res.redirect(302, `${clientOrigin}/login?verificado=true`);

  } catch (error) {
    console.error('Error al confirmar cuenta:', error.message);
    res.status(500).send(renderMessagePage('Error Interno', 'Error del Servidor', 'Ocurrió un error inesperado al activar tu cuenta. Por favor, contacta con soporte.', false));
  }
});

// GET /api/auth/independizacion/aprobar/:token
router.get('/independizacion/aprobar/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).send(renderMessagePage('Error', 'Token Inválido', 'No se ha provisto ningún token de independización.', false));
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    // Buscar en la tabla tokens_independizacion
    const { data: record, error: findRecordError } = await supabase
      .from('tokens_independizacion')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expira_en', now)
      .maybeSingle();

    if (findRecordError || !record) {
      return res.status(400).send(renderMessagePage('Enlace Expirado', 'Aprobación Fallida', 'El enlace de aprobación es inválido, ha expirado (límite de 24 horas) o ya ha sido utilizado.', false));
    }

    // Buscar el paciente
    const { data: paciente, error: findError } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_paciente', record.paciente_id)
      .maybeSingle();

    if (findError || !paciente) {
      return res.status(404).send(renderMessagePage('No Encontrado', 'Error de Paciente', 'El paciente asociado a esta solicitud no existe.', false));
    }

    if (paciente.id_perfil_propio) {
      return res.status(400).send(renderMessagePage('Cuenta Activa', 'Proceso Completado', 'Esta cuenta ya ha sido activada anteriormente y cuenta con acceso autónomo.', false));
    }

    // Ejecutar transacción lógica: desvincular apoderado en la ficha del paciente
    const { error: updateError } = await supabase
      .from('pacientes')
      .update({
        id_apoderado: null,
        estado_cuenta: 'INDEPENDIENTE'
      })
      .eq('id_paciente', paciente.id_paciente);

    if (updateError) {
      throw updateError;
    }

    const clientOrigin = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

    // Redirigir al frontend al flujo de independización con el mismo token
    res.redirect(302, `${clientOrigin}/independizarse?token=${encodeURIComponent(token)}`);

  } catch (error) {
    console.error('Error al aprobar independización:', error.message);
    res.status(500).send(renderMessagePage('Error Interno', 'Error del Servidor', 'Ocurrió un error inesperado al procesar la aprobación. Por favor, contacta con soporte.', false));
  }
});

export default router;
