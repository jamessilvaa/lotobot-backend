const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3000;

// Habilitar CORS e JSON
app.use(cors());
app.use(express.json());

// Em produção, use um banco de dados real (MongoDB, PostgreSQL, etc.)
// Este é apenas um exemplo para demonstração
const validTokens = {
  // Token: {expiry, plan}
  'DEMO123': {
    expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    plan: 'basic',
    createdAt: new Date().toISOString()
  },
  'PREMIUM456': {
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
    plan: 'premium',
    createdAt: new Date().toISOString()
  }
};

// Chave secreta para API - em produção, use variáveis de ambiente
const API_SECRET = process.env.API_SECRET || 'sua_chave_secreta_aqui';

// Endpoint para validar tokens
app.post('/validate-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token não fornecido' });
  }
  
  // Verificar se o token existe e não expirou
  if (validTokens[token] && new Date(validTokens[token].expiry) > new Date()) {
    return res.json({
      valid: true,
      expiry: validTokens[token].expiry,
      plan: validTokens[token].plan
    });
  }
  
  return res.json({ valid: false, message: 'Token inválido ou expirado' });
});

// Endpoint para criar tokens (protegido por chave de API)
app.post('/create-token', (req, res) => {
  const { apiKey, planType, durationDays } = req.body;
  
  // Verificar chave de API
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ success: false, message: 'Chave de API inválida' });
  }
  
  // Gerar token único
  const token = generateUniqueToken();
  
  // Calcular data de expiração
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (durationDays || 30));
  
  // Armazenar token
  validTokens[token] = {
    expiry: expiry.toISOString(),
    plan: planType || 'basic',
    createdAt: new Date().toISOString()
  };
  
  return res.json({
    success: true,
    token,
    expiry: expiry.toISOString(),
    plan: planType || 'basic'
  });
});

// Endpoint para listar todos os tokens (protegido)
app.get('/list-tokens', (req, res) => {
  const { apiKey } = req.query;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ success: false, message: 'Chave de API inválida' });
  }
  
  return res.json({
    success: true,
    tokens: validTokens
  });
});

// Endpoint para revogar um token (protegido)
app.post('/revoke-token', (req, res) => {
  const { apiKey, token } = req.body;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ success: false, message: 'Chave de API inválida' });
  }
  
  if (!validTokens[token]) {
    return res.status(404).json({ success: false, message: 'Token não encontrado' });
  }
  
  // Expirar o token imediatamente
  validTokens[token].expiry = new Date(0).toISOString();
  
  return res.json({
    success: true,
    message: 'Token revogado com sucesso'
  });
});

// Função para gerar token único
function generateUniqueToken() {
  // Gerar string aleatória de 10 caracteres
  const randomPart = crypto.randomBytes(5).toString('hex');
  // Adicionar timestamp para garantir unicidade
  const timestampPart = Date.now().toString(36);
  // Combinar as partes
  return `${randomPart}${timestampPart}`.toUpperCase();
}

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor de validação de tokens rodando na porta ${port}`);
});