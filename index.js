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
  ssl: {
    rejectUnauthorized: false, // Necessário para conexões SSL no Render
  },
});

// Rota principal ("/")
app.get('/', (req, res) => {
  res.send(`
    <h1>Bem-vindo ao Chatbot de Fretes!</h1>
    <p>Rotas disponíveis:</p>
    <ul>
      <li><strong>GET /fretes</strong>: Lista os fretes disponíveis.</li>
      <li><strong>POST /motoristas</strong>: Cadastra um novo motorista.</li>
      <li><strong>PUT /motoristas</strong>: Atualiza dados de um motorista.</li>
      <li><strong>POST /notificacoes</strong>: Habilita notificações de novos fretes.</li>
      <li><strong>GET /tipos-caminhoes</strong>: Lista os tipos de caminhões disponíveis.</li>
    </ul>
  `);
});

// Rota para listar fretes (com filtros opcionais)
app.get('/fretes', async (req, res) => {
  const { regiao, carga } = req.query;
  try {
    let query = 'SELECT * FROM fretes';
    const queryParams = [];
    if (regiao || carga) {
      query += ' WHERE ';
      if (regiao) {
        query += 'origem ILIKE $1';
        queryParams.push(`%${regiao}%`);
      }
      if (carga) {
        if (regiao) query += ' AND ';
        query += 'carga ILIKE $2';
        queryParams.push(`%${carga}%`);
      }
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar fretes.' });
  }
});

// Rota para listar tipos de caminhões
app.get('/tipos-caminhoes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_caminhoes');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tipos de caminhões.' });
  }
});

// Função para validar tipo de caminhão
const validateTipoVeiculo = async (tipoVeiculo) => {
  const result = await pool.query('SELECT * FROM tipos_caminhoes WHERE nome ILIKE $1', [tipoVeiculo]);
  return result.rows.length > 0;
};

// Rota para cadastrar motoristas
app.post('/motoristas', async (req, res) => {
  const { nome, telefone, cnh, tipo_veiculo, regiao } = req.body;

  // Validação básica
  if (!nome || !telefone || !cnh || !tipo_veiculo || !regiao) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  if (!/^\d{11}$/.test(cnh)) {
    return res.status(400).json({ error: 'O número da CNH deve ter 11 dígitos.' });
  }

  const isValidTipoVeiculo = await validateTipoVeiculo(tipo_veiculo);
  if (!isValidTipoVeiculo) {
    return res.status(400).json({ error: 'Tipo de veículo inválido. Escolha um tipo de caminhão válido.' });
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

// Rota para atualizar dados do motorista
app.put('/motoristas', async (req, res) => {
  const { telefone, regiao } = req.body;

  if (!telefone || !regiao) {
    return res.status(400).json({ error: 'Telefone e região são obrigatórios.' });
  }

  try {
    await pool.query(
      'UPDATE motoristas SET regiao = $1 WHERE telefone = $2',
      [regiao, telefone]
    );
    res.json({ message: 'Dados atualizados com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar dados do motorista.' });
  }
});

// Rota para habilitar notificações de novos fretes
app.post('/notificacoes', async (req, res) => {
  const { telefone, regiao } = req.body;

  if (!telefone || !regiao) {
    return res.status(400).json({ error: 'Telefone e região são obrigatórios.' });
  }

  try {
    await pool.query(
      'INSERT INTO notificacoes (telefone, regiao) VALUES ($1, $2)',
      [telefone, regiao]
    );
    res.json({ message: `Você receberá notificações de novos fretes para ${regiao}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao habilitar notificações.' });
  }
});

// Rota para o webhook do Dialogflow
app.post('/webhook', async (req, res) => {
  const intentName = req.body.queryResult.intent.displayName;

  // Lógica para "Consultar Fretes"
  if (intentName === 'Consultar Fretes') {
    const parameters = req.body.queryResult.parameters;
    const regiao = parameters.regiao || '';
    const carga = parameters.carga || '';

    try {
      let query = 'SELECT * FROM fretes';
      const queryParams = [];
      if (regiao || carga) {
        query += ' WHERE ';
        if (regiao) {
          query += 'origem ILIKE $1';
          queryParams.push(`%${regiao}%`);
        }
        if (carga) {
          if (regiao) query += ' AND ';
          query += 'carga ILIKE $2';
          queryParams.push(`%${carga}%`);
        }
      }

      const result = await pool.query(query, queryParams);
      const freteList = result.rows.map((frete, index) => ({
        origem: frete.origem,
        destino: frete.destino,
        valor: frete.valor,
        carga: frete.carga,
      }));

      if (freteList.length === 0) {
        return res.json({
          fulfillmentText: 'Nenhum frete encontrado com os critérios informados.',
        });
      }

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

    if (!/^\d{11}$/.test(cnh)) {
      return res.json({
        fulfillmentText: 'O número da CNH deve ter 11 dígitos.',
      });
    }

    const isValidTipoVeiculo = await validateTipoVeiculo(tipoVeiculo);
    if (!isValidTipoVeiculo) {
      return res.json({
        fulfillmentText: 'Tipo de veículo inválido. Escolha um tipo de caminhão válido.',
      });
    }

    try {
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

  // Lógica para "Atualizar Dados do Motorista"
  if (intentName === 'Atualizar Dados do Motorista') {
    const parameters = req.body.queryResult.parameters;
    const telefone = parameters.telefone || '';
    const regiao = parameters.regiao || '';

    if (!telefone || !regiao) {
      return res.json({
        fulfillmentText: 'Telefone e região são obrigatórios.',
      });
    }

    try {
      await pool.query(
        'UPDATE motoristas SET regiao = $1 WHERE telefone = $2',
        [regiao, telefone]
      );

      return res.json({
        fulfillmentText: 'Seus dados foram atualizados com sucesso!',
      });
    } catch (err) {
      console.error(err);
      return res.json({ fulfillmentText: 'Erro ao atualizar seus dados.' });
    }
  }

  // Lógica para "Notificar Novos Fretes"
  if (intentName === 'Notificar Novos Fretes') {
    const parameters = req.body.queryResult.parameters;
    const telefone = parameters.telefone || '';
    const regiao = parameters.regiao || '';

    if (!telefone || !regiao) {
      return res.json({
        fulfillmentText: 'Telefone e região são obrigatórios.',
      });
    }

    try {
      await pool.query(
        'INSERT INTO notificacoes (telefone, regiao) VALUES ($1, $2)',
        [telefone, regiao]
      );

      return res.json({
        fulfillmentText: `Você receberá notificações de novos fretes para ${regiao}.`,
      });
    } catch (err) {
      console.error(err);
      return res.json({ fulfillmentText: 'Erro ao habilitar notificações.' });
    }
  }

  // Resposta padrão para intenções não tratadas
  return res.json({ fulfillmentText: 'Desculpe, não entendi sua solicitação.' });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});