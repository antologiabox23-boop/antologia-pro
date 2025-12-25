// api/reportes.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(request, response) {
  let client;
  try {
    client = await pool.connect();
    
    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Método no permitido' });
    }

    const { tipo } = request.query; // 'asistencia' o 'pagos'

    if (tipo === 'asistencia') {
      const query = `
        SELECT a.date, u.name, u.class_time 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, u.name ASC
      `;
      const result = await client.query(query);
      return response.status(200).json(result.rows);

    } else if (tipo === 'pagos') {
      const query = `
        SELECT i.payment_date, u.name, i.amount, i.payment_method, i.description, i.start_date, i.end_date
        FROM income i
        JOIN users u ON i.user_id = u.id
        ORDER BY i.payment_date DESC
      `;
      const result = await client.query(query);
      return response.status(200).json(result.rows);
    }

    return response.status(400).json({ error: 'Tipo de reporte no especificado' });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Error al obtener reporte', detalle: error.message });
  } finally {
    if (client) client.release();
  }
};
