# Configuração de IP Fixo no Windows para Comunicação Mobile-API

## Problema
O IP do PC muda a cada reinicialização, dificultando a comunicação entre o app mobile e a API.

## Solução: Configurar IP Fixo no Windows

### Passo 1: Identificar informações da rede atual

Execute no PowerShell ou CMD:
```powershell
ipconfig /all
```

Anote:
- **Endereço IPv4 atual**: 192.168.0.105
- **Máscara de Sub-rede**: 255.255.255.0
- **Gateway Padrão**: 192.168.0.1
- **Servidores DNS**: (geralmente 192.168.0.1 ou fornecido pelo provedor)

### Passo 2: Configurar IP Fixo via Interface Gráfica

1. Abra **Configurações do Windows** (Win + I)
2. Vá em **Rede e Internet** → **Wi-Fi** (ou **Ethernet**)
3. Clique no nome da sua conexão Wi-Fi
4. Role até **Configurações de IP**
5. Clique em **Editar**
6. Selecione **Manual**
7. Ative **IPv4**
8. Preencha:
   - **Endereço IP**: `192.168.0.105`
   - **Máscara de sub-rede**: `255.255.255.0`
   - **Gateway**: `192.168.0.1`
   - **DNS preferencial**: `192.168.0.1` (ou o DNS do seu provedor)
   - **DNS alternativo**: `8.8.8.8` (Google DNS)
9. Clique em **Salvar**

### Passo 3: Configurar IP Fixo via PowerShell (Alternativa)

Execute como Administrador:

```powershell
# Substitua "Wi-Fi" pelo nome da sua interface de rede
# Para listar interfaces: Get-NetAdapter

New-NetIPAddress -InterfaceAlias "Wi-Fi" -IPAddress 192.168.0.105 -PrefixLength 24 -DefaultGateway 192.168.0.1

Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "192.168.0.1", "8.8.8.8"
```

### Passo 4: Verificar configuração

```powershell
ipconfig
```

Você deve ver:
```
Adaptador de Rede sem Fio Wi-Fi:
   Endereço IPv4. . . . . . . . . . . . : 192.168.0.105
   Máscara de Sub-rede . . . . . . . . . : 255.255.255.0
   Gateway Padrão. . . . . . . . . . . . : 192.168.0.1
```

### Passo 5: Testar conectividade

No mobile, teste acessar:
- API: `http://192.168.0.105:3001/api/health`
- Swagger: `http://192.168.0.105:3001/api-docs`

## Configurações já aplicadas no código

✅ **API** (`API/index.cjs`):
- Servidor configurado para ouvir em `0.0.0.0:3001` (todas as interfaces)
- Logs mostram o IP da rede local ao iniciar

✅ **Mobile** (`MOBILE/src/services/api.ts`):
- IP padrão configurado: `192.168.0.105:3001`
- Sistema de cache para URL da API

✅ **Vite Preview** (`MOBILE/vite.config.ts`):
- Preview configurado para usar IP fixo no proxy
- Host configurado como `0.0.0.0` para acesso via rede

## Notas Importantes

⚠️ **Conflito de IP**: Se outro dispositivo já estiver usando `192.168.0.105`, você precisará:
- Usar outro IP na faixa `192.168.0.2` a `192.168.0.254`
- Atualizar o IP em `MOBILE/src/services/api.ts` e `MOBILE/vite.config.ts`

⚠️ **Rede diferente**: Se você mudar de rede Wi-Fi, o IP fixo pode não funcionar. Nesse caso:
- Configure um novo IP fixo na nova rede
- Ou use DHCP e atualize o IP no mobile manualmente

## Troubleshooting

### Problema: Não consigo acessar a internet após configurar IP fixo
**Solução**: Verifique se o Gateway e DNS estão corretos. Use os mesmos valores que funcionavam com DHCP.

### Problema: Mobile não consegue conectar à API
**Solução**: 
1. Verifique se o firewall do Windows permite conexões na porta 3001
2. Certifique-se de que o PC e o mobile estão na mesma rede Wi-Fi
3. Teste ping do mobile para o PC: `ping 192.168.0.105`

### Problema: IP fixo não persiste após reiniciar
**Solução**: Verifique se você salvou as configurações corretamente. Use o método via PowerShell para garantir persistência.

