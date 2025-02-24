const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // Para conexão com PostgreSQL
require('dotenv').config(); // Para carregar variáveis de ambiente

const app = express();
const port = process.env.PORT || 5000;

// Middleware para interpretar JSON
app.use(bodyParser.json());

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Rota principal ("/")
app.get('/', (req, res) => {
  res.send(`
    <h1>Bem-vindo ao Chatbot de Fretes!</h1>
    <p>Rotas disponíveis:</p>
    <ul>
      <li><strong>GET /fretes</strong>: Lista os fretes disponíveis.</li>
      <li><strong>POST /motoristas</strong>: Cadastra um novo motorista.</li>
    </ul>
  `);
});

// Rota para listar fretes
app.get('/fretes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fretes');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar fretes.' });
  }
});

// Rota para cadastrar motoristas
app.post('/motoristas', async (req, res) => {
  const { nome, telefone, cnh, tipo_veiculo, regiao } = req.body;

  // Validação básica
  if (!nome || !telefone || !cnh || !tipo_veiculo || !regiao) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    await pool.query(
      'INSERT INTO motoristas (nome, telefone, cnh, tipo_veiculo, regiao) VALUES ($1, $2, $3, $4, $5)',
      [nome, telefone, cnh, tipo_veiculo, regiao]
    );
    res.status(201).json({ message: 'Motorista cadastrado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar motorista.' });
  }
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});