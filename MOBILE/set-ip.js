
const os = require('os');
const fs = require('fs');

console.log('Detectando o endereço IP da rede local...');

const networkInterfaces = os.networkInterfaces();
let ipAddress = null;

// Itera sobre todas as interfaces de rede (ex: 'Wi-Fi', 'Ethernet')
for (const interfaceName in networkInterfaces) {
  const interfaces = networkInterfaces[interfaceName];
  for (const iface of interfaces) {
    // Procura por um endereço IPv4 que não seja interno (localhost)
    if (iface.family === 'IPv4' && !iface.internal) {
      // Prioriza IPs da rede 192.168.x.x, que é a mais comum em ambientes domésticos.
      if (iface.address.startsWith('192.168')) {
        ipAddress = iface.address;
        break;
      }
    }
  }
  if (ipAddress) break;
}

if (ipAddress) {
  // ATENÇÃO: A porta deve ser a mesma onde seu servidor backend está rodando.
  // Com base nas suas imagens, o servidor está na porta 3000.
  const port = 3000;
  const apiUrl = `http://${ipAddress}:${port}`;
  console.log(`Endereço IP encontrado: ${ipAddress}`);
  console.log(`URL da API configurada para: ${apiUrl}`);

  // Cria um arquivo .env.local que será lido automaticamente pelo Vite.
  // O Vite prioriza variáveis em .env.local sobre outros arquivos .env.
  const envContent = `VITE_API_BASE_URL=${apiUrl}`;

  fs.writeFileSync('.env.local', envContent);
  console.log('Arquivo .env.local criado com sucesso!');
} else {
  console.error('ERRO: Não foi possível encontrar um endereço IP de rede local válido.');
  console.error('Por favor, verifique se você está conectado a uma rede Wi-Fi ou Ethernet.');
  process.exit(1); // Encerra o script com um código de erro.
}
