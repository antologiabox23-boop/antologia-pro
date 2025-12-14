import { Pool } from 'pg';

// Configuración de la conexión (Vercel inyecta esto automáticamente)
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request, response) {
  const client = await pool.connect();

  try {
    // 1. OBTENER TODOS LOS USUARIOS (GET)
    if (request.method === 'GET') {
      // Usamos "AS" para cambiar snake_case (BD) a camelCase (Frontend)
      const result = await client.query(`
        SELECT 
          id, name, document, 
          TO_CHAR(birthdate, 'YYYY-MM-DD') as birthdate, 
          phone, eps, rh, pathology,
          emergency_contact as "emergencyContact",
          emergency_phone as "emergencyPhone",
          class_time as "classTime",
          affiliation_type as "affiliationType",
          status,
          created_at as "createdAt"
        FROM users 
        ORDER BY name ASC
      `);
      return response.status(200).json(result.rows);
    }

    // 2. CREAR UN USUARIO NUEVO (POST)
    if (request.method === 'POST') {
      const { 
        id, name, document, birthdate, phone, eps, rh, pathology, 
        emergencyContact, emergencyPhone, classTime, affiliationType, status 
      } = request.body;

      // Importante: El orden de los $1, $2 debe coincidir con el array de values
      const query = `
        INSERT INTO users (
          id, name, document, birthdate, phone, eps, rh, pathology, 
          emergency_contact, emergency_phone, class_time, affiliation_type, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const values = [
        id, name, document, birthdate, phone, eps, rh, pathology, 
        emergencyContact, emergencyPhone, classTime, affiliationType, status || 'active'
      ];

      const result = await client.query(query, values);
      return response.status(201).json(result.rows[0]);
    }

    // 3. ACTUALIZAR UN USUARIO (PUT)
    if (request.method === 'PUT') {
      const { 
        id, name, document, birthdate, phone, eps, rh, pathology, 
        emergencyContact, emergencyPhone, classTime, affiliationType, status 
      } = request.body;

      const query = `
        UPDATE users SET 
          name = $1, document = $2, birthdate = $3, phone = $4, 
          eps = $5, rh = $6, pathology = $7, 
          emergency_contact = $8, emergency_phone = $9, 
          class_time = $10, affiliation_type = $11, status = $12
        WHERE id = $13
        RETURNING *
      `;

      const values = [
        name, document, birthdate, phone, eps, rh, pathology, 
        emergencyContact, emergencyPhone, classTime, affiliationType, status,
        id // El ID va al final porque es el $13
      ];

      const result = await client.query(query, values);
      return response.status(200).json(result.rows[0]);
    }

    // 4. ELIMINAR UN USUARIO (DELETE)
    if (request.method === 'DELETE') {
      const { id } = request.query; // El ID viene en la URL ?id=ATG...
      
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      return response.status(200).json({ message: 'Usuario eliminado' });
    }

  } catch (error) {
    console.error('Error en API Usuarios:', error);
    return response.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
