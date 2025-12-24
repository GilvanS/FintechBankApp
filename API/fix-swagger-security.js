// Script para corrigir segurança no Swagger e Postman Collection
const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');

// Endpoints que NÃO precisam de autenticação
const NO_AUTH_ENDPOINTS = [
    '/health',
    '/auth/login',
    '/auth/signup',
    '/auth/request-password-reset',
    '/auth/reset-password',
    '/shop/products',
    '/pix/recipient-info' // versão GET com query params
];

function normalizePath(path) {
    // Remove path parameters para comparação
    return path.replace(/\/:[^/]+/g, '/:param');
}

function needsAuth(path, method) {
    const normalized = normalizePath(path);
    
    // Verificar se está na lista de não-autenticados
    for (const noAuthPath of NO_AUTH_ENDPOINTS) {
        if (normalized === normalizePath(noAuthPath)) {
            return false;
        }
    }
    
    // Todos os outros precisam de autenticação
    return true;
}

// Corrigir Swagger
function fixSwagger(swaggerPath) {
    console.log('🔧 Corrigindo Swagger...');
    const swagger = yaml.load(swaggerPath);
    
    if (!swagger.paths) {
        console.log('⚠️  Swagger não tem paths');
        return;
    }
    
    let fixed = 0;
    let total = 0;
    
    for (const [path, pathItem] of Object.entries(swagger.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                continue;
            }
            
            total++;
            const requiresAuth = needsAuth(path, method);
            const hasSecurity = operation.security && operation.security.length > 0;
            const hasBearerAuth = hasSecurity && operation.security.some(s => s.bearerAuth);
            
            if (requiresAuth && !hasBearerAuth) {
                // Adicionar segurança
                if (!operation.security) {
                    operation.security = [];
                }
                operation.security.push({ bearerAuth: [] });
                fixed++;
                console.log(`✅ Adicionado security em ${method.toUpperCase()} ${path}`);
            } else if (!requiresAuth && hasBearerAuth) {
                // Remover segurança
                operation.security = operation.security.filter(s => !s.bearerAuth);
                if (operation.security.length === 0) {
                    delete operation.security;
                }
                fixed++;
                console.log(`✅ Removido security de ${method.toUpperCase()} ${path}`);
            }
        }
    }
    
    // Salvar
    const yamlString = yaml.dump(swagger, { indent: 2, lineWidth: 120 });
    fs.writeFileSync(swaggerPath, yamlString, 'utf8');
    
    console.log(`\n📊 Swagger: ${fixed} endpoints corrigidos de ${total} total\n`);
}

// Corrigir Postman Collection
function fixPostmanCollection(collectionPath) {
    console.log('🔧 Corrigindo Postman Collection...');
    const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
    
    let fixed = 0;
    let total = 0;
    
    function processItem(item) {
        if (item.request) {
            total++;
            const url = typeof item.request.url === 'string' 
                ? item.request.url 
                : (item.request.url?.raw || item.request.url?.path?.join('/') || '');
            
            // Extrair path e method
            const method = item.request.method || 'GET';
            let path = url.replace(/{{baseUrl}}\/?/g, '').replace(/\?.*$/, '');
            
            // Normalizar path
            if (path.startsWith('/')) path = path.substring(1);
            path = '/' + path;
            
            const requiresAuth = needsAuth(path, method);
            const hasAuthHeader = item.request.header && 
                item.request.header.some(h => 
                    (h.key === 'Authorization' || h.key === 'authorization') && 
                    (h.value && (h.value.includes('Bearer') || h.value.includes('{{token}}')))
                );
            
            if (requiresAuth && !hasAuthHeader) {
                // Adicionar header de autorização
                if (!item.request.header) {
                    item.request.header = [];
                }
                
                // Verificar se já tem Content-Type
                const hasContentType = item.request.header.some(h => 
                    h.key === 'Content-Type' || h.key === 'content-type'
                );
                
                if (!hasContentType && method !== 'GET') {
                    item.request.header.push({
                        key: 'Content-Type',
                        value: 'application/json'
                    });
                }
                
                // Adicionar Authorization
                item.request.header.push({
                    key: 'Authorization',
                    value: 'Bearer {{token}}',
                    type: 'text'
                });
                
                fixed++;
                console.log(`✅ Adicionado Authorization em ${method} ${path}`);
            } else if (!requiresAuth && hasAuthHeader) {
                // Remover header de autorização
                item.request.header = item.request.header.filter(h => 
                    h.key !== 'Authorization' && h.key !== 'authorization'
                );
                fixed++;
                console.log(`✅ Removido Authorization de ${method} ${path}`);
            }
        }
        
        if (item.item && Array.isArray(item.item)) {
            item.item.forEach(processItem);
        }
    }
    
    if (collection.item && Array.isArray(collection.item)) {
        collection.item.forEach(processItem);
    }
    
    // Salvar
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
    
    console.log(`\n📊 Postman Collection: ${fixed} endpoints corrigidos de ${total} total\n`);
}

// Executar
const swaggerPath = path.join(__dirname, 'swagger.yaml');
const collectionPath = path.join(__dirname, 'postman-collection.json');

if (fs.existsSync(swaggerPath)) {
    fixSwagger(swaggerPath);
} else {
    console.log('⚠️  Swagger não encontrado:', swaggerPath);
}

if (fs.existsSync(collectionPath)) {
    fixPostmanCollection(collectionPath);
} else {
    console.log('⚠️  Postman Collection não encontrado:', collectionPath);
}

console.log('✅ Correção concluída!');
