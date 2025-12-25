const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(request, response) {
  let client;
  try {
    client = await pool.connect();
    
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Método no permitido' });
    }

    const { type, userId, date, startDate, endDate, paymentMethod, amount, description } = request.body;

    if (type === 'attendance') {
      const query = `INSERT INTO attendance (id, user_id, date) VALUES ($1, $2, $3) RETURNING *`;
      const values = [Date.now().toString(), userId, date];
      const result = await client.query(query, values);
      return response.status(201).json({ message: 'Asistencia registrada', data: result.rows[0] });

    } else if (type === 'income') {
      // Validamos que el monto sea un número válido antes de enviar a SQL
      const finalAmount = parseFloat(amount);
      if (isNaN(finalAmount)) {
        return response.status(400).json({ error: 'El monto no es un número válido' });
      }

      // IMPORTANTE: Aseguramos que las fechas vacías sean NULL para Postgres
      const query = `
        INSERT INTO income (id, user_id, payment_date, start_date, end_date, payment_method, amount, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`;
      
      const values = [
        Date.now().toString(),
        userId,
        date,
        startDate || null,
        endDate || null,
        paymentMethod,
        finalAmount,
        description || ''
      ];

      const result = await client.query(query, values);
      return response.status(201).json({ message: 'Pago registrado con éxito', data: result.rows[0] });
    }

    return response.status(400).json({ error: 'Tipo de operación no válida' });

  } catch (error) {
    console.error(error);
    // Este mensaje de error detallado te ayudará a ver qué falló en el alert de tu pantalla
    return response.status(500).json({ 
      error: 'Error en la base de datos', 
      detalle: error.message,
      codigo: error.code 
    });
  } finally {
    if (client) client.release();
  }
};
