const express = require('express');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('chromedriver');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const LOTTERIES = {
  'Mega-Sena': 6,
  'Lotofácil': 15,
  'Lotomania': 20,
};

const CONFIGS = {
  'Mega-Sena': { filePath: 'mega_sena_results.csv', maxNum: 60, url: 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx', className: 'numbers megasena' },
  'Lotofácil': { filePath: 'lotofacil_results.csv', maxNum: 25, url: 'https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx', className: 'simple-container lista-dezenas lotofacil' },
  'Lotomania': { filePath: 'lotomania_results.csv', maxNum: 100, url: 'https://loterias.caixa.gov.br/Paginas/Lotomania.aspx', className: 'simple-container lista-dezenas lotomania' },
};

const updateLotteryResults = async (lottery) => {
  const { filePath, url, className } = CONFIGS[lottery];
  const fullPath = path.join(__dirname, filePath);
  let driver;

  try {
    const chromeOptions = new (require('selenium-webdriver/chrome').Options)();
    chromeOptions.addArguments('--headless');
    chromeOptions.addArguments('--disable-blink-features=AutomationControlled'); // Evita detecção de automação
    chromeOptions.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'); // Define um user-agent realista
    chromeOptions.addArguments('--no-sandbox'); // Necessário para alguns ambientes (como o Render)
    chromeOptions.addArguments('--disable-dev-shm-usage'); // Evita problemas de memória em servidores
    chromeOptions.addArguments('--disable-gpu'); // Evita problemas gráficos em modo headless
    chromeOptions.addArguments('--window-size=1920,1080'); // Define um tamanho de janela realista
    chromeOptions.addArguments('--disable-extensions'); // Desativa extensões que podem interferir
    chromeOptions.addArguments('--disable-infobars'); // Desativa barras de informação
    chromeOptions.addArguments('--disable-notifications'); // Desativa notificações
    chromeOptions.excludeSwitches(['enable-automation']); // Remove flags de automação visíveis
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    await driver.get(url);
    await driver.sleep(5000); // Espera adicional de 5 segundos para o JavaScript carregar os elementos

    // Espera explícita até que o elemento esteja presente (máximo de 30 segundos)
    const resultContainer = await driver.wait(
      until.elementLocated(By.className(className)),
      30000
    );
    const numberElements = await resultContainer.findElements(By.tagName('li'));
    const numbers = [];
    for (let elem of numberElements) {
      const text = await elem.getText();
      if (!isNaN(text)) numbers.push(parseInt(text));
    }

    if (numbers.length !== LOTTERIES[lottery]) {
      throw new Error(`Número de bolas inválido para ${lottery}: ${numbers.length} encontrados.`);
    }

    const dateElements = await driver.findElements(By.className('ng-binding'));
    let contestNumber = 'Desconhecido';
    let drawDate = new Date().toISOString().split('T')[0];
    for (let elem of dateElements) {
      const text = await elem.getText();
      const match = text.match(/Concurso (\d+) \((\d{2}\/\d{2}\/\d{4})\)/);
      if (match) {
        contestNumber = match[1];
        drawDate = match[2];
        break;
      }
    }

    const headers = Array.from({ length: LOTTERIES[lottery] }, (_, i) => `Bola${i + 1}`).concat(['Concurso', 'Data']);
    let csvData = '';
    try {
      csvData = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      csvData = headers.join(',') + '\n';
    }

    const rows = csvData.split('\n').filter(row => row.trim());
    const newRow = [...numbers, contestNumber, drawDate].join(',');
    rows.push(newRow);
    await fs.writeFile(fullPath, rows.join('\n'));

    return { success: true, message: `Resultados de ${lottery} atualizados.` };
  } catch (error) {
    return { success: false, message: `Erro ao atualizar ${lottery}: ${error.message}` };
  } finally {
    if (driver) await driver.quit();
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