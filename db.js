const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS abrigos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        endereco TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        capacidade_total INT NOT NULL,
        ocupados_atual INT DEFAULT 0,
        contato VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS voluntarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        cidade VARCHAR(100) NOT NULL,
        disponibilidade VARCHAR(50),
        habilidades VARCHAR(100),
        senha VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'ativo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS resgates (
        id SERIAL PRIMARY KEY,
        nome_solicitante VARCHAR(255) DEFAULT 'Anônimo',
        telefone VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        endereco_descricao TEXT,
        num_pessoas INT DEFAULT 1,
        tem_crianca BOOLEAN DEFAULT false,
        tem_idoso BOOLEAN DEFAULT false,
        tem_deficiente BOOLEAN DEFAULT false,
        audio_url TEXT,
        observacoes TEXT,
        status VARCHAR(20) DEFAULT 'aguardando',
        voluntario_id INT,
        voluntario_nome VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const adminRows = await pool.query('SELECT * FROM admin WHERE email = $1', ['admin@sistema.com']);
    if (adminRows.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO admin (email, senha) VALUES ($1, $2)',
        ['admin@sistema.com', hashedPassword]
      );
      console.log('Admin padrão criado: admin@sistema.com / admin123');
    }

    console.log('Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
  }
};

initDatabase();

module.exports = pool;