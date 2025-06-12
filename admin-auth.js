// Sistema de autenticação do administrador
const AdminAuth = {
  // Token de administrador
  _adminHash: 'ADM_LOTOBOT_252023@#',
  
  // Validar se é token de administrador
  validateAdminToken(token) {
    try {
      return token === this._adminHash;
    } catch (error) {
      return false;
    }
  },
  
  // Configurar sessão de administrador com validade vitalícia
  setupAdminSession(token) {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 100); // Validade vitalícia (100 anos)
    
    localStorage.setItem('lotobot_token', token);
    localStorage.setItem('lotobot_token_expiry', expiryDate.toISOString());
    localStorage.setItem('isAdmin', 'true');
    
    return true;
  },
  
  // Verificar se é administrador autenticado
  isAuthenticated() {
    const storedToken = localStorage.getItem('lotobot_token');
    const isAdmin = localStorage.getItem('isAdmin');
    const tokenExpiry = localStorage.getItem('lotobot_token_expiry');
    
    return storedToken &&
           isAdmin === 'true' &&
           tokenExpiry &&
           new Date(tokenExpiry) > new Date();
  },
  
  // Obter o token de administrador
  getAdminToken() {
    return this._adminHash;
  }
};
