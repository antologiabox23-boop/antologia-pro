import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL + "?sslmode=require" });

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM income ORDER BY date DESC');
      return response.status(200).json(rows);
    }
    
    if (request.method === 'POST') {
      const inc = request.body;
      await pool.query(
        'INSERT INTO income (id, user_id, start_date, end_date, amount, method, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
        [inc.id, inc.userId, inc.startDate, inc.endDate, inc.amount, inc.method, inc.description, inc.date]
      );
      return response.status(200).json({ message: 'Pago guardado' });
    }
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
