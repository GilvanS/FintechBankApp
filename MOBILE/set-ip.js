import os from 'os';
import fs from 'fs';

console.log('Detectando o endereço IP da rede local...');

const networkInterfaces = os.networkInterfaces();
let ipAddress = null;

for (const interfaceName in networkInterfaces) {
  const interfaces = networkInterfaces[interfaceName];
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      if (iface.address.startsWith('192.168')) {
        ipAddress = iface.address;
        break;
      }
    }
  }
  if (ipAddress) break;
}

const port = 3001;
let apiUrl;

if (ipAddress) {
  apiUrl = `http://${ipAddress}:${port}`;
  console.log(`Endereço IP de rede encontrado: ${ipAddress}`);
} else {
  apiUrl = `http://localhost:${port}`;
  console.log('Nenhum IP de rede encontrado. Usando localhost como padrão.');
}

console.log(`URL da API configurada para: ${apiUrl}`);
const envContent = `VITE_API_BASE_URL=${apiUrl}`;
fs.writeFileSync('.env.local', envContent);
console.log('Arquivo .env.local criado com sucesso!');
