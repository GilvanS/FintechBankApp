// ... existing code ...
const jwt = require('jsonwebtoken');

function genReqId() {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapScopesFromRole(role) {
  if (role === 'admin') return ['admin', 'customer'];
  return ['customer'];
}

function bearerAuth() {
  const JWT_SECRET = process.env.JWT_SECRET || 'fintech-super-secret-key-change-me';
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token de acesso requerido.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err || !user) return res.status(403).json({ success: false, message: 'Token invalido.' });
      req.user = user;
      req.user.scopes = mapScopesFromRole(user.role);
      next();
    });
  };
}

function requireScope(scope) {
  return (req, res, next) => {
    const scopes = (req.user && req.user.scopes) || [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    next();
  };
}

function pinGuard(field = 'pin') {
  return (req, res, next) => {
    const pin = req.body && req.body[field];
    if (!pin || typeof pin !== 'string' || pin.length !== 4) {
      return res.status(400).json({ success: false, message: 'PIN ausente ou invalido.' });
    }
    next();
  };
}

function withReqId(req, res, next) {
  const existing = req.headers['x-request-id'];
  const reqId = existing || genReqId();
  req.id = reqId;
  res.set('x-request-id', reqId);
  next();
}

function auditLog(req, action, level = 'info', meta = {}) {
  const safeMeta = { ...meta };
  if (safeMeta.pin) delete safeMeta.pin;
  const entry = { reqId: req.id, user: req.user ? { cpf: req.user.cpf, role: req.user.role } : undefined, action, meta: safeMeta };
  const line = `[${new Date().toISOString()}] ${action} ${JSON.stringify(entry)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = { bearerAuth, requireScope, pinGuard, withReqId, auditLog };