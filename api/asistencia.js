// api/asistencia.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = async function handler(request, response) {
  let client; // Declaramos client fuera del try para que finally lo pueda ver

  try {
    client = await pool.connect();
    
    // Verificamos que el método sea POST
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método no permitido. Use POST.' });
    }
    
    // Obtenemos el cuerpo de la petición
    const { 
      type, userId, date, 
      // Datos de Pago
      startDate, endDate, paymentMethod, amount, description 
    } = request.body;

    if (!type || !userId) {
        return response.status(400).json({ error: 'Faltan parámetros: type y userId son obligatorios.' });
    }

    if (type === 'attendance') {
      // --- REGISTRO DE ASISTENCIA ---
      const query = `
        INSERT INTO attendance (id, user_id, date) 
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const id = Date.now(); 
      const values = [id.toString(), userId, date]; // Convertimos el ID a string para evitar problemas de BIGINT
      const result = await client.query(query, values);
      return response.status(201).json({ 
          message: 'Asistencia registrada con éxito', 
          data: result.rows[0] 
      });

    } else if (type === 'income') {
      // --- REGISTRO DE PAGO ---
      if (!amount || isNaN(parseFloat(amount))) {
         return response.status(400).json({ error: 'Monto inválido para el pago.' });
      }
      
      const query = `
        INSERT INTO income (id, user_id, payment_date, start_date, end_date, payment_method, amount, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const id = Date.now();
      const values = [
        id.toString(), // ID como string
        userId, 
        date, 
        startDate || null, // Permite nulo si no se especifica
        endDate || null,   // Permite nulo si no se especifica
        paymentMethod, 
        parseFloat(amount), 
        description
      ];
      const result = await client.query(query, values);
      return response.status(201).json({ 
          message: 'Pago registrado con éxito', 
          data: result.rows[0] 
      });

    } else {
      return response.status(400).json({ error: 'Tipo de registro no válido' });
    }

  } catch (error) {
    console.error(`Error en API Asistencia/Ingresos: ${error.message}`);
    // Añadimos un error 500 para ver en el navegador
    return response.status(500).json({ error: 'Error interno del servidor al registrar acción', detalle: error.message });
  } finally {
    // Aseguramos la liberación del cliente
    if (client) {
        client.release();
    }
  }
}
