const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Rota para listar fretes
app.get('/fretes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fretes');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar fretes');
  }
});

// Rota para cadastrar motoristas
app.post('/motoristas', async (req, res) => {
  const { nome, telefone, cnh, tipo_veiculo, regiao } = req.body;
  try {
    await pool.query(
      'INSERT INTO motoristas (nome, telefone, cnh, tipo_veiculo, regiao) VALUES ($1, $2, $3, $4, $5)',
      [nome, telefone, cnh, tipo_veiculo, regiao]
    );
    res.status(201).send('Motorista cadastrado com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao cadastrar motorista');
  }
});

// Webhook para o Dialogflow
app.post('/webhook', async (req, res) => {
  const intentName = req.body.queryResult.intent.displayName;

  if (intentName === 'Consultar Fretes') {
    try {
      const result = await pool.query('SELECT * FROM fretes');
      const freteList = result.rows.map((frete, index) => ({
        origem: frete.origem,
        destino: frete.destino,
        valor: frete.valor,
        carga: frete.carga,
      }));

      const responseText = freteList
        .map(
          (frete, index) =>
            `${index + 1}. Origem: ${frete.origem}, Destino: ${frete.destino}, Valor: ${
              frete.valor
            }, Carga: ${frete.carga}`
        )
        .join('\n');

      return res.json({
        fulfillmentText: `Aqui estão os fretes disponíveis:\n${responseText}`,
      });
    } catch (err) {
      console.error(err);
      return res.json({ fulfillmentText: 'Erro ao buscar fretes.' });
    }
  }

  // Outras intenções podem ser tratadas aqui
  return res.json({ fulfillmentText: 'Desculpe, não entendi sua solicitação.' });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});