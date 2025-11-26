import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL + "?sslmode=require" });

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM attendance ORDER BY date DESC LIMIT 500');
      return response.status(200).json(rows);
    }
    
    if (request.method === 'POST') {
      const att = request.body;
      await pool.query(
        'INSERT INTO attendance (id, user_id, date, timestamp) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [att.id, att.userId, att.date, att.timestamp]
      );
      return response.status(200).json({ message: 'Asistencia guardada' });
    }
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
