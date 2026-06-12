import { supabase } from '../config/supabase.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Se requiere token.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verificamos el token JWT con la API de Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    // Inyectamos el usuario autenticado en la petición
    req.user = user;
    next();
  } catch (err) {
    console.error('Error en middleware requireAuth:', err.message);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
};
