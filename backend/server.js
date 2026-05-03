const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Leer el secreto de Docker (contraseña de DB)
let dbPassword = '';
try {
  // Docker Swarm inyecta los secrets en /run/secrets/
  dbPassword = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
} catch (err) {
  console.warn('Advertencia: No se pudo leer el secreto /run/secrets/db_password. Usando contraseña fallback.');
  dbPassword = process.env.MYSQL_ROOT_PASSWORD || 'MiPasswordSegura123';
}

// Configuración de MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'database', // Service name en docker-compose
  user: process.env.DB_USER || 'root',
  password: dbPassword,
  database: process.env.DB_NAME || 'techretail_db'
};

// Configuración de Redis
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'cache'}:6379`
});

redisClient.on('error', (err) => console.error('Error en cliente Redis:', err));

let pool;

async function init() {
  try {
    // 1. Conectar a Redis
    await redisClient.connect();
    console.log('✅ Conectado a Redis');

    // 2. Conectar a MySQL (usamos pool para manejar reconexiones)
    pool = mysql.createPool(dbConfig);
    
    // Verificar conexión MySQL
    await pool.query('SELECT 1');
    console.log('✅ Conectado a MySQL');

    // 3. Crear tabla e insertar datos de prueba si no existen
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INT NOT NULL
      )
    `);

    // Comprobar si hay datos
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM products');
    if (rows[0].count === 0) {
      await connection.query(`
        INSERT INTO products (name, price, stock) VALUES 
        ('Laptop Gamer Pro', 1200.50, 15),
        ('Smartphone X', 799.99, 40),
        ('Auriculares Bluetooth', 59.99, 100),
        ('Monitor 4K', 350.00, 20),
        ('Teclado Mecánico', 85.00, 50)
      `);
      console.log('✅ Datos de prueba insertados en MySQL');
    }
    connection.release();

  } catch (err) {
    console.error('❌ Error en la inicialización (MySQL/Redis):', err);
    // En Docker Swarm, si fallamos inicializando, es mejor dejar que el contenedor muera y reinicie.
    process.exit(1); 
  }
}

// Retrasar la inicialización un poco para dar tiempo a que la BD suba
setTimeout(init, 5000);

// Endpoint de estado
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TechRetail Backend API funcionando',
    container_host: require('os').hostname()
  });
});

// Endpoint para obtener productos (usa Caché)
app.get('/api/products', async (req, res) => {
  try {
    // 1. Intentar obtener de Redis
    const cacheKey = 'products_list';
    const cachedProducts = await redisClient.get(cacheKey);

    if (cachedProducts) {
      console.log('📦 Productos obtenidos de REDIS (Caché)');
      return res.json({
        source: 'cache',
        container: require('os').hostname(),
        data: JSON.parse(cachedProducts)
      });
    }

    // 2. Si no está en Redis, obtener de MySQL
    if (!pool) throw new Error('No hay conexión a la base de datos');
    
    console.log('🗄️ Productos obtenidos de MYSQL (Base de datos)');
    const [rows] = await pool.query('SELECT * FROM products');
    
    // 3. Guardar en Redis para próximas peticiones (expira en 15 segundos para la demo)
    await redisClient.setEx(cacheKey, 15, JSON.stringify(rows));

    res.json({
      source: 'database',
      container: require('os').hostname(),
      data: rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend escuchando en el puerto ${port}`);
});
