import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';
import { registrarPacienteConsolidado } from './controllers/pacientesController.js';

async function runTest() {
  console.log("Iniciando prueba de rollback de Auth...");

  // DNI aleatorio para evitar la validación de duplicados de DNI inicial
  const randomDni = String(Math.floor(10000000 + Math.random() * 90000000));
  const randomEmail = `test_rollback_${Date.now()}@example.com`;

  // Mock Request: enviamos fechaNacimiento con formato inválido para hacer fallar el insert en la base de datos
  const req = {
    body: {
      isProxy: false,
      password: 'TestPassword123!',
      patientData: {
        dni: randomDni,
        nombres: 'TestRollback',
        apellidoPaterno: 'Test',
        apellidoMaterno: 'Rollback',
        fechaNacimiento: 'not-a-valid-date-format-which-will-fail-postgres', 
        genero: 'Masculino',
        correoReal: randomEmail
      }
    }
  };

  // Mock Response
  let statusSet = 200;
  const res = {
    status: function(code) {
      statusSet = code;
      return this;
    },
    json: function(data) {
      console.log(`\nRespuesta de la API (Status ${statusSet}):`, JSON.stringify(data, null, 2));
      return data;
    }
  };

  try {
    await registrarPacienteConsolidado(req, res);
    
    // Consultar si el correo creado persiste en Supabase Auth
    console.log(`\nVerificando si el correo ${randomEmail} existe en Supabase Auth...`);
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    const foundUser = usersData.users.find(u => u.email === randomEmail);
    if (foundUser) {
      console.error(`❌ ERROR: El usuario con email ${randomEmail} sigue existiendo en Supabase Auth! El rollback falló.`);
      process.exit(1);
    } else {
      console.log(`✅ ÉXITO: El usuario con email ${randomEmail} no existe en Supabase Auth (fue eliminado correctamente por el rollback).`);
      process.exit(0);
    }
  } catch (err) {
    console.error("Error en la ejecución del test:", err);
    process.exit(1);
  }
}

runTest();
