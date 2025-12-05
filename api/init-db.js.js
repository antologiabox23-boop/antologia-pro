import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL + "?sslmode=require" 
});

export default async function handler(request, response) {
    try {
        // Crear tabla de usuarios
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                document VARCHAR(50) UNIQUE,
                phone VARCHAR(20),
                birthdate DATE,
                eps VARCHAR(100),
                rh VARCHAR(10),
                emergency_contact VARCHAR(100),
                emergency_phone VARCHAR(20),
                class_time VARCHAR(50),
                affiliation_type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla de asistencias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla de pagos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS income (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
                start_date DATE,
                end_date DATE,
                amount DECIMAL(10, 2),
                method VARCHAR(50),
                description TEXT,
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        response.status(200).json({ 
            message: 'Base de datos inicializada correctamente' 
        });
    } catch (error) {
        console.error('Error inicializando base de datos:', error);
        response.status(500).json({ 
            error: 'Error inicializando base de datos',
            details: error.message 
        });
    }
}