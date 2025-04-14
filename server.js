const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'Backend do AI LotoBot funcionando! Use /update/:lottery ou /results/:lottery.' });
});

const LOTTERIES = {
  'Mega-Sena': 6,
  'Lotofácil': 15,
  'Lotomania': 20,
};

const CONFIGS = {
  'Mega-Sena': { filePath: 'mega_sena_results.csv', maxNum: 60, apiName: 'mega-sena' },
  'Lotofácil': { filePath: 'lotofacil_results.csv', maxNum: 25, apiName: 'lotofacil' },
  'Lotomania': { filePath: 'lotomania_results.csv', maxNum: 100, apiName: 'lotomania' },
};

const updateLotteryResults = async (lottery) => {
  if (!CONFIGS[lottery]) {
    return { success: false, message: 'Loteria inválida.' };
  }
  const { filePath, apiName } = CONFIGS[lottery];
  const fullPath = path.join(__dirname, filePath);
  try {
    const response = await axios.get(`https://loteriascaixa-api.herokuapp.com/api/${apiName}/latest`);
    const { concurso, data, dezenas } = response.data;

    // Garantir que o número de dezenas corresponde ao esperado
    if (dezenas.length !== LOTTERIES[lottery]) {
      return { success: false, message: `Número de dezenas inválido para ${lottery}: ${dezenas.length} encontrados.` };
    }

    const headers = Array.from({ length: LOTTERIES[lottery] }, (_, i) => `Bola${i + 1}`).concat(['Concurso', 'Data']);
    let csvData = '';
    try {
      csvData = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      csvData = headers.join(',') + '\n';
    }

    const rows = csvData.split('\n').filter(row => row.trim());
    const newRow = [...dezenas, concurso, data].join(',');
    rows.push(newRow);
    await fs.writeFile(fullPath, rows.join('\n'));

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
  const { filePath } = CONFIGS[lottery];
  const fullPath = path.join(__dirname, filePath);
  try {
    const csvData = await fs.readFile(fullPath, 'utf-8');
    const rows = csvData.split('\n').filter(row => row.trim());
    const headers = rows[0].split(',');
    const data = rows.slice(1).map(row => {
      const values = row.split(',');
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = values[i];
      });
      return obj;
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao ler resultados: ${error.message}` });
  }
});

app.listen(3000, () => {
  console.log('Backend rodando em http://localhost:3000');
});