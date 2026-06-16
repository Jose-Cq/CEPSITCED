import crypto from 'crypto';

// Utiliza la variable JWT_SECRET o SUPABASE_SERVICE_KEY como semilla para generar una clave de 32 bytes
const getSecretKey = () => {
  const rawSecret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_KEY || 'cepsitced-super-default-secret-key-32-chars-long';
  return crypto.createHash('sha256').update(rawSecret).digest();
};

const IV_LENGTH = 16; // Para AES CBC el IV es siempre de 16 bytes

/**
 * Genera un token cifrado para independización de cuenta.
 * @param {object} payload - Datos a incluir en el token { id_paciente, DNI }
 * @param {number} expiresInMs - Tiempo de expiración (por defecto 24 horas)
 * @returns {string} Token en formato iv:texto_cifrado
 */
export const generateToken = (payload, expiresInMs = 24 * 60 * 60 * 1000) => {
  const key = getSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + expiresInMs
  });
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Verifica y descifra el token de independización.
 * @param {string} token - Token en formato iv:texto_cifrado
 * @returns {object|null} Payload descifrado o null si es inválido/expirado
 */
export const verifyToken = (token) => {
  try {
    if (!token) return null;
    const parts = token.split(':');
    if (parts.length !== 2) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const key = getSecretKey();
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload = JSON.parse(decrypted);
    if (Date.now() > payload.exp) {
      console.warn("Token de independización expirado");
      return null;
    }
    
    return payload;
  } catch (err) {
    console.error("Error al descifrar token de independización:", err.message);
    return null;
  }
};
