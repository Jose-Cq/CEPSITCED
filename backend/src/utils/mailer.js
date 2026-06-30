import nodemailer from 'nodemailer';

/**
 * Envía un correo con el token y el enlace para activar la cuenta independiente.
 * @param {string} toEmail - Correo electrónico destinatario
 * @param {string} nombresPaciente - Nombre completo del paciente a independizar
 * @param {string} token - Token cifrado de independización
 * @param {object} req - Objeto de petición Express (para inferir el origen/dominio del cliente)
 * @returns {Promise<object>} Resultado del envío
 */
export const sendIndependizacionEmail = async (toEmail, nombresPaciente, token, req) => {
  const clientOrigin = req.headers.origin || 'http://localhost:5173';
  const link = `${clientOrigin}/independizarse?token=${encodeURIComponent(token)}`;
  
  console.log(`\n======================================================`);
  console.log(`📧 ENVÍO DE EMAIL DE INDEPENDIZACIÓN`);
  console.log(`Para: ${toEmail}`);
  console.log(`Paciente: ${nombresPaciente}`);
  console.log(`Link: ${link}`);
  console.log(`======================================================\n`);

  // Configuración SMTP desde variables de entorno
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || '"CEPSITCED Portal" <no-reply@cepsitced.com>';

  const isProduction = process.env.NODE_ENV === 'production';

  let transporter;
  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else {
    if (isProduction) {
      console.error('Error: Las credenciales SMTP no están configuradas en producción.');
      return {
        success: false,
        error: 'No se pudo enviar el correo de activación: El servidor SMTP no está configurado en producción (falta SMTP_HOST, SMTP_USER o SMTP_PASS).'
      };
    }

    // Modo Desarrollo / Fallback: crear una cuenta de prueba temporal en ethereal.email
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.warn('Advertencia: No se pudo configurar la cuenta SMTP temporal de Ethereal. Fallback a salida de consola.', err.message);
      return { success: false, error: `Error al configurar Ethereal Mail: ${err.message}`, link };
    }
  }

  const mailOptions = {
    from: smtpFrom,
    to: toEmail,
    subject: 'Solicitud de Activación de Cuenta Independiente - CEPSITCED',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #003178; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">CEPSITCED</h2>
          <span style="font-size: 11px; text-transform: uppercase; tracking-wider; color: #718096; font-weight: bold;">Portal del Paciente</span>
        </div>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Hola,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Hemos recibido una solicitud para activar el acceso independiente de <strong>${nombresPaciente}</strong> en el portal clínico CEPSITCED.</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Al completar esta activación, el paciente podrá ingresar directamente con su propio DNI y su nueva contraseña, manteniendo intacto su historial clínico, citas y documentos existentes.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${link}" style="background-color: #003178; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 12px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 49, 120, 0.25); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Activar Cuenta Independiente</a>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #718096; margin-top: 30px;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p style="font-size: 12px; color: #003178; word-break: break-all; background-color: #f7fafc; padding: 12px; border-radius: 8px; border: 1px solid #edf2f7; font-family: monospace;">${link}</p>
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 30px 0;" />
        <p style="font-size: 11px; line-height: 1.4; color: #a0aec0; text-align: center;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (!smtpHost) {
      console.log(`✉️ Correo de prueba enviado con éxito a Ethereal. URL de vista previa: ${nodemailer.getTestMessageUrl(info)}`);
      return { success: true, etherealUrl: nodemailer.getTestMessageUrl(info), link };
    }
    return { success: true, messageId: info.messageId, link };
  } catch (err) {
    console.error('Error al enviar el correo mediante nodemailer:', err.message);
    return { success: false, error: err.message, link };
  }
};

/**
 * Envía un correo de notificación a administración ante una solicitud de cambio de especialista.
 */
export const sendSolicitudCambioPsicologoEmail = async ({
  nombresPaciente,
  dniPaciente,
  servicio,
  psicologoAnterior,
  psicologoNuevo,
  motivo
}) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || '"CEPSITCED Portal" <no-reply@cepsitced.com>';
  const adminEmail = process.env.SMTP_ADMIN_EMAIL || 'admin@cepsitced.com';

  const isProduction = process.env.NODE_ENV === 'production';

  console.log(`\n======================================================`);
  console.log(`📧 ENVÍO DE EMAIL DE SOLICITUD DE CAMBIO DE ESPECIALISTA`);
  console.log(`Para: ${adminEmail}`);
  console.log(`Paciente: ${nombresPaciente} (DNI: ${dniPaciente})`);
  console.log(`Servicio: ${servicio}`);
  console.log(`Psicólogo Anterior: ${psicologoAnterior}`);
  console.log(`Psicólogo Nuevo: ${psicologoNuevo}`);
  console.log(`Motivo: ${motivo}`);
  console.log(`======================================================\n`);

  let transporter;
  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else {
    if (isProduction) {
      console.error('Error: Las credenciales SMTP no están configuradas en producción.');
      return { success: false, error: 'Credenciales SMTP no configuradas.' };
    }
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.warn('Advertencia: No se pudo configurar la cuenta SMTP temporal de Ethereal.', err.message);
      return { success: false, error: err.message };
    }
  }

  const mailOptions = {
    from: smtpFrom,
    to: adminEmail,
    subject: 'Solicitud de Revisión: Cambio Excesivo de Especialista - CEPSITCED',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #c53030; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">CEPSITCED</h2>
          <span style="font-size: 11px; text-transform: uppercase; tracking-wider; color: #e53e3e; font-weight: bold;">Control de Cambios de Especialista</span>
        </div>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Estimado Administrador,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Se ha registrado una nueva solicitud de cambio de psicólogo que supera el límite establecido para un servicio. La cita asociada ha sido registrada en estado <strong>"Pendiente de aprobación por cambio de especialista"</strong> y requiere revisión manual en la administración del sistema.</p>
        
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 12px; border: 1px solid #edf2f7; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2d3748; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Detalles de la Solicitud</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4a5568; width: 40%;">Paciente:</td>
              <td style="padding: 6px 0; color: #2d3748;">${nombresPaciente} (DNI: ${dniPaciente})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Servicio:</td>
              <td style="padding: 6px 0; color: #2d3748;">${servicio}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Psicólogo Anterior:</td>
              <td style="padding: 6px 0; color: #4a5568; font-style: italic;">${psicologoAnterior || 'No especificado / Sin citas previas'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Psicólogo Nuevo:</td>
              <td style="padding: 6px 0; color: #2d3748; font-weight: bold;">${psicologoNuevo}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fffaf0; padding: 20px; border-radius: 12px; border: 1px solid #feebc8; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #dd6b20; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #fbd38d; padding-bottom: 8px;">Motivo del Cambio (Obligatorio)</h3>
          <p style="font-size: 13px; line-height: 1.6; color: #7b341e; font-style: italic; margin: 10px 0 0 0;">"${motivo}"</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 30px 0;" />
        <p style="font-size: 11px; line-height: 1.4; color: #a0aec0; text-align: center;">Este es un correo automático del sistema CEPSITCED.</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (!smtpHost) {
      console.log(`✉️ Correo de solicitud de cambio enviado con éxito a Ethereal. URL de vista previa: ${nodemailer.getTestMessageUrl(info)}`);
      return { success: true, etherealUrl: nodemailer.getTestMessageUrl(info) };
    }
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error al enviar correo de solicitud de cambio:', err.message);
    return { success: false, error: err.message };
  }
};
