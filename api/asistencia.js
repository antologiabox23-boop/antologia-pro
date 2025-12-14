// api/asistencia.js
import { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request, response) {
  const client = await pool.connect();

  try {
    if (request.method === 'POST') {
      const { 
        type, userId, date, 
        // Datos de Pago
        startDate, endDate, paymentMethod, amount, description 
      } = request.body;

      if (type === 'attendance') {
        // Lógica para registrar asistencia
        const query = `
          INSERT INTO attendance (id, user_id, date) 
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        const id = Date.now(); // Usamos Date.now() como ID único, como en tu código original
        const values = [id, userId, date];
        const result = await client.query(query, values);
        return response.status(201).json({ 
            message: 'Asistencia registrada con éxito', 
            data: result.rows[0] 
        });

      } else if (type === 'income') {
        // Lógica para registrar pago
        const query = `
          INSERT INTO income (id, user_id, payment_date, start_date, end_date, payment_method, amount, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const id = Date.now();
        const values = [id, userId, date, startDate, endDate, paymentMethod, amount, description];
        const result = await client.query(query, values);
        return response.status(201).json({ 
            message: 'Pago registrado con éxito', 
            data: result.rows[0] 
        });

      } else {
        return response.status(400).json({ error: 'Tipo de registro no válido' });
      }
    }
    
    // Si no es POST, por ahora solo mostramos un error
    return response.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error(`Error en API Asistencia/Ingresos: ${error.message}`);
    return response.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
