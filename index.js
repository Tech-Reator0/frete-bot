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

app.post('/webhook', async (req, res) => {
  const intentName = req.body.queryResult.intent.displayName;

  // Lógica para "Consultar Fretes"
  if (intentName === 'Consultar Fretes') {
    try {
      const result = await pool.query('SELECT * FROM fretes');
      const freteList = result.rows.map((frete) => ({
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

  // Lógica para "Cadastro de Motoristas"
  if (intentName === 'Cadastro de Motoristas') {
    const parameters = req.body.queryResult.parameters;
    const nome = parameters.nome || '';
    const telefone = parameters.telefone || '';
    const cnh = parameters.cnh || '';
    const tipoVeiculo = parameters.tipo_veiculo || '';
    const regiao = parameters.regiao || '';

    // Verifica se todos os campos foram preenchidos
    if (!nome || !telefone || !cnh || !tipoVeiculo || !regiao) {
      return res.json({
        fulfillmentText: 'Por favor, forneça todas as informações necessárias.',
      });
    }

    try {
      // Insere o motorista no banco de dados
      await pool.query(
        'INSERT INTO motoristas (nome, telefone, cnh, tipo_veiculo, regiao) VALUES ($1, $2, $3, $4, $5)',
        [nome, telefone, cnh, tipoVeiculo, regiao]
      );

      return res.json({
        fulfillmentText: `Motorista cadastrado com sucesso! Nome: ${nome}, Telefone: ${telefone}`,
      });
    } catch (err) {
      console.error(err);
      return res.json({ fulfillmentText: 'Erro ao cadastrar motorista.' });
    }
  }

  // Resposta padrão para intenções não tratadas
  return res.json({ fulfillmentText: 'Desculpe, não entendi sua solicitação.' });
});


// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});