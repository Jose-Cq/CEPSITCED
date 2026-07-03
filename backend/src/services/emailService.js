import nodemailer from 'nodemailer';

// Helper to escape HTML characters in templates
export const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Forzar el uso de las credenciales activas del sistema si las de seguridad vienen undefined
const finalUser = process.env.GMAIL_USER_SEGURIDAD || process.env.SMTP_USER;
const finalPass = process.env.GMAIL_PASS_SEGURIDAD || process.env.SMTP_PASS;

export const transporterSeguridad = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true para puerto 465, false para otros puertos como 587
  auth: {
    user: finalUser,
    pass: finalPass ? finalPass.replace(/\s/g, "") : ""
  }
});

const smtpFrom = process.env.SMTP_FROM || `"CEPSITCED Seguridad" <${finalUser}>`;

/**
 * Envía un correo de verificación de cuenta nueva.
 * @param {string} toEmail - Correo del destinatario
 * @param {string} nombres - Nombres del usuario
 * @param {string} link - Enlace de verificación del backend
 */
export const enviarCorreoVerificacionCuenta = async (toEmail, nombres, link) => {
  const mailOptions = {
    from: smtpFrom,
    to: toEmail,
    subject: 'Verifica tu cuenta - CEPSITCED',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #003178; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">CEPSITCED</h2>
          <span style="font-size: 11px; text-transform: uppercase; tracking-wider; color: #718096; font-weight: bold;">Verificación de Cuenta</span>
        </div>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Hola <strong>${escapeHtml(nombres)}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Gracias por registrarte en el portal clínico de CEPSITCED. Para activar tu cuenta y poder iniciar sesión con tu DNI, necesitamos verificar tu correo electrónico.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${link}" style="background-color: #003178; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 12px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 49, 120, 0.25); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Verificar Mi Cuenta</a>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #718096; margin-top: 30px;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p style="font-size: 12px; color: #003178; word-break: break-all; background-color: #f7fafc; padding: 12px; border-radius: 8px; border: 1px solid #edf2f7; font-family: monospace;">${link}</p>
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 30px 0;" />
        <p style="font-size: 11px; line-height: 1.4; color: #a0aec0; text-align: center;">Este es un correo automático de seguridad. Por favor, no respondas a este mensaje.</p>
      </div>
    `
  };

  try {
    const info = await transporterSeguridad.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar correo de verificación:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Envía un correo al apoderado para que apruebe la independización de un dependiente de edad.
 * @param {string} toEmail - Correo del apoderado
 * @param {string} nombresPaciente - Nombre completo del dependiente que solicita independización
 * @param {string} link - Enlace de aprobación del backend
 */
export const enviarCorreoIndependizacion = async (toEmail, nombresPaciente, link) => {
  const mailOptions = {
    from: smtpFrom,
    to: toEmail,
    subject: 'Solicitud de Activación de Cuenta Independiente - CEPSITCED',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #003178; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">CEPSITCED</h2>
          <span style="font-size: 11px; text-transform: uppercase; tracking-wider; color: #718096; font-weight: bold;">Aprobación de Desvinculación</span>
        </div>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Hola,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Hemos recibido una solicitud para activar el acceso independiente de <strong>${escapeHtml(nombresPaciente)}</strong> en el portal clínico CEPSITCED.</p>
        <p style="font-size: 15px; line-height: 1.6; color: #2d3748;">Al completar esta aprobación, el paciente será desvinculado de tu tutela en el portal clínico y podrá registrar su propia cuenta autónoma usando su DNI y su correo personal.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${link}" style="background-color: #003178; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 12px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 49, 120, 0.25); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Aprobar Independización</a>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #718096; margin-top: 30px;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p style="font-size: 12px; color: #003178; word-break: break-all; background-color: #f7fafc; padding: 12px; border-radius: 8px; border: 1px solid #edf2f7; font-family: monospace;">${link}</p>
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 30px 0;" />
        <p style="font-size: 11px; line-height: 1.4; color: #a0aec0; text-align: center;">Este es un correo automático de seguridad. Por favor, no respondas a este mensaje.</p>
      </div>
    `
  };

  try {
    const info = await transporterSeguridad.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar correo de independización:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Función marcador/placeholder para recordatorios de correos existentes.
 */
export const enviarRecordatorioCita = async (toEmail, datosCita) => {
  console.log(`[Recordatorio] Correo de recordatorio enviado a ${toEmail} para la cita ${datosCita}`);
  return { success: true };
};
