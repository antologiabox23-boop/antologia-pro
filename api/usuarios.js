// api/usuarios.js
const { Pool } = require('pg');

// Vercel inyectará automáticamente la variable POSTGRES_URL o DATABASE_URL
// Usamos process.env para leerla de forma segura
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para Neon en algunos entornos
  }
});

export default async function handler(request, response) {
  try {
    // 1. Intentamos conectar
    const client = await pool.connect();
    
    // 2. Hacemos una consulta simple.
    // (Asegúrate de tener alguna tabla creada, o usa 'SELECT NOW()' para probar fecha)
    const result = await client.query('SELECT NOW() as tiempo_actual');
    
    // 3. Liberamos el cliente
    client.release();

    // 4. Respondemos al Frontend con los datos
    return response.status(200).json({ 
      status: 'Conexión Exitosa con Neon', 
      data: result.rows 
    });

  } catch (error) {
    console.error('Error de base de datos:', error);
    return response.status(500).json({ error: 'Error conectando a la BD', detalle: error.message });
  }
}
