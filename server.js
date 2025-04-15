const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();

const corsOptions = {
  origin: 'https://mellifluous-parfait-19e8ec.netlify.app',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(express.json());

// Inicializar o banco de dados SQLite
const db = new sqlite3.Database('lottery_results.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Criar tabelas para cada loteria
const LOTTERIES = {
  'Mega-Sena': 6,
  'Lotofácil': 15,
  'Lotomania': 20,
};

const CONFIGS = {
  'Mega-Sena': { tableName: 'mega_sena', maxNum: 60, apiName: 'megasena' },
  'Lotofácil': { tableName: 'lotofacil', maxNum: 25, apiName: 'lotofacil' },
  'Lotomania': { tableName: 'lotomania', maxNum: 100, apiName: 'lotomania' },
};

// Criar tabelas se não existirem
for (const [lottery, { tableName, numbers }] of Object.entries(CONFIGS)) {
  const columns = Array.from({ length: LOTTERIES[lottery] }, (_, i) => `Bola${i + 1} INTEGER`).join(', ');
  db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${columns},
    Concurso INTEGER,
    Data TEXT
  )`);
}

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'Backend do AI LotoBot funcionando! Use /update/:lottery ou /results/:lottery.' });
});

const updateLotteryResults = async (lottery) => {
  if (!CONFIGS[lottery]) {
    return { success: false, message: 'Loteria inválida.' };
  }
  const { tableName, apiName } = CONFIGS[lottery];
  try {
    const response = await axios.get(`https://apiloterias.com.br/app/resultado?loteria=${apiName}&token=34gPVAbIkxWVvJ8`);
    const { numero_concurso, data_sorteio, dezenas } = response.data;

    if (dezenas.length !== LOTTERIES[lottery]) {
      return { success: false, message: `Número de dezenas inválido para ${lottery}: ${dezenas.length} encontrados.` };
    }

    const columns = Array.from({ length: LOTTERIES[lottery] }, (_, i) => `Bola${i + 1}`).concat(['Concurso', 'Data']);
    const placeholders = columns.map(() => '?').join(', ');
    const values = [...dezenas, numero_concurso, data_sorteio];

    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return { success: true, message: `Resultados de ${lottery} atualizados.` };
  } catch (error) {
    return { success: false, message: `Erro ao atualizar ${lottery}: ${error.message}` };
  }
};

app.get('/update/:lottery', async (req, res) => {
  const lottery = req.params.lottery;
  if (!CONFIGS[lottery]) {
    return res.status(400).json({ success: false, message: 'Loteria inválida.' });
  }
  const result = await updateLotteryResults(lottery);
  res.json(result);
});

app.get('/results/:lottery', async (req, res) => {
  const lottery = req.params.lottery;
  if (!CONFIGS[lottery]) {
    return res.status(400).json({ success: false, message: 'Loteria inválida.' });
  }
  const { tableName } = CONFIGS[lottery];
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao ler resultados: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
