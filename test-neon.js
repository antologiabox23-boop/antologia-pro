import pg from 'pg';
const { Pool } = pg;

async function testConnection() {
  try {
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL || 'tu_connection_string_aqui?sslmode=require'
    });
    
    console.log('Intentando conectar a Neon...');
    const client = await pool.connect();
    
    console.log('✅ Conectado a Neon PostgreSQL!');
    
    // Crear una tabla de prueba
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insertar datos de prueba
    await client.query(
      'INSERT INTO test_table (message) VALUES ($1)',
      ['Conexión exitosa a Neon!']
    );
    
    // Leer datos
    const result = await client.query('SELECT * FROM test_table');
    console.log('📊 Datos de prueba:', result.rows);
    
    client.release();
    await pool.end();
    
    console.log('✅ Prueba completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('\nPosibles soluciones:');
    console.log('1. Verifica tu connection string de Neon');
    console.log('2. Asegúrate de que Neon esté activo');
    console.log('3. Verifica que tengas permisos de escritura');
    process.exit(1);
  }
}

testConnection();