import pg from 'pg';
const { Pool } = pg;

// Configurar CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL + "?sslmode=require" 
});

export default async function handler(request, response) {
    // Manejar preflight CORS
    if (request.method === 'OPTIONS') {
        return response.status(200).set(corsHeaders).end();
    }

    // Aplicar headers CORS
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.setHeader(key, value);
    });

    try {
        if (request.method === 'GET') {
            const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
            return response.status(200).json(rows);
        } 
        
        if (request.method === 'POST') {
            const user = request.body;
            
            // Validar datos requeridos
            if (!user.name || !user.document) {
                return response.status(400).json({ error: 'Nombre y documento son requeridos' });
            }

            // Insertar o actualizar usuario
            const query = `
                INSERT INTO users (
                    id, name, document, phone, birthdate, eps, rh, 
                    emergency_contact, emergency_phone, class_time, 
                    affiliation_type, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET 
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    document = EXCLUDED.document,
                    status = EXCLUDED.status,
                    affiliation_type = EXCLUDED.affiliation_type,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `;
            
            const values = [
                user.id,
                user.name,
                user.document,
                user.phone || null,
                user.birthdate || null,
                user.eps || null,
                user.rh || null,
                user.emergencyContact || null,
                user.emergencyPhone || null,
                user.classTime || null,
                user.affiliationType || null,
                user.status || 'active',
                user.createdAt || new Date().toISOString()
            ];
            
            const result = await pool.query(query, values);
            return response.status(200).json({ 
                message: 'Usuario guardado', 
                user: result.rows[0] 
            });
        }
    } catch (error) {
        console.error('Error en users API:', error);
        return response.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}
