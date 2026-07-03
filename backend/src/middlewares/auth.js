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

    // Verificar si el usuario está activo en la tabla de perfiles (solo aplica a pacientes)
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('activo')
      .eq('id', user.id)
      .maybeSingle();

    if (perfil && perfil.activo === false) {
      return res.status(403).json({ error: 'Cuenta inactiva. Por favor, verifica tu correo electrónico para activarla.' });
    }

    next();
  } catch (err) {
    console.error('Error en middleware requireAuth:', err.message);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
};
