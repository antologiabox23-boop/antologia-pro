import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL + "?sslmode=require" });

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM users');
      return response.status(200).json(rows);
    } 
    
    if (request.method === 'POST') {
      const user = request.body;
      // Guardamos o actualizamos el usuario (Upsert)
      const query = `
        INSERT INTO users (id, name, document, phone, birthdate, eps, rh, emergency_contact, emergency_phone, class_time, affiliation_type, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, phone = EXCLUDED.phone, status = EXCLUDED.status, affiliation_type = EXCLUDED.affiliation_type;
      `;
      const values = [user.id, user.name, user.document, user.phone, user.birthdate, user.eps, user.rh, user.emergencyContact, user.emergencyPhone, user.classTime, user.affiliationType, user.status];
      
      await pool.query(query, values);
      return response.status(200).json({ message: 'Usuario guardado' });
    }
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
