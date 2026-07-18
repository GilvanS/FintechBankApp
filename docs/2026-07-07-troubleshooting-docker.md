# Histórico de Incidentes - Docker, Portainer e Banco de Dados

## Data: 07 de Julho de 2026

### Incidente:
Após a reinicialização da máquina (inédito após 8 meses de estabilidade), os containers do Portainer e do ambiente `dbautomacao` (PostgreSQL e pgAdmin) desapareceram do painel de execução, impossibilitando o acesso ao banco de dados pelo pgAdmin (porta 16543) e ao gerenciamento pelo Portainer (porta 9000).

### Causa Raiz Provável:
Devido a uma provável atualização do Docker Desktop Windows, um desligamento abrupto da engine do WSL, ou uma falha inesperada de sistema, o Docker realizou um expurgo de containers antigos que estavam em estado inativo. 
Como o `docker-compose.yml` da API e a inicialização original do Portainer não contavam com a diretiva de restart automático, os containers não subiram novamente no boot. No entanto, o mais importante foi validado: **os volumes de dados (`portainer_data` e volume do pgdb) permaneceram 100% seguros e não sofreram alterações.**

### Ações Corretivas Executadas:

**1. Restabelecimento do Portainer:**
O container foi recriado apontando para o mesmo volume histórico. A porta 8000 foi omitida pois estava causando conflito de binding no Docker Desktop no boot do sistema.
```bash
docker run -d -p 9000:9000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
```

**2. Destravamento da Senha do Administrador:**
A sessão do Portainer negou login com a senha clássica possivelmente devido à inconsistência do cofre interno durante a queda brusca. Foi forçado o reset de senha da conta `admin` injetando diretamente a credencial correta (`admingilvansousa`) na base Boltdb do Portainer:
```bash
docker stop portainer
docker run --rm -v portainer_data:/data portainer/helper-reset-password --password "admingilvansousa"
docker start portainer
```

**3. Restabelecimento do Projeto de Automação (Banco):**
Na pasta `F:\GITHUB\FintechBankApp\API`, o orquestrador local do compose foi religado, restaurando o container `pgdb` (5432) e reconectando o visualizador `pgadmin` (16543):
```bash
docker-compose up -d
```

### Prevenção Futura:
Para evitar que uma nova pane de Windows ou upgrade agressivo do Docker desligue permanentemente os serviços, deve-se manter a flag `restart: always` ativada em todos os *compose files* sensíveis no futuro. O arquivo `.md` atualiza e documenta todo o procedimento de desastre/recuperação rápida para referência técnica e da própria Inteligência Artificial.
