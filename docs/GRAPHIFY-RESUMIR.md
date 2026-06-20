# Retomar graphify

graphify já está instalado. A detecção do corpus foi feita — 1021 arquivos encontrados.

## Escolha uma subpasta e rode

```powershell
# Opção A — só a API (64 arquivos, rápido ~2 min)
/graphify API

# Opção B — frontend web (141 arquivos, ~5 min)
/graphify WEB

# Opção C — app mobile (625 arquivos, ~15 min)
/graphify MOBILE

# Opção D — projeto inteiro (860+ arquivos, ~25 min)
/graphify .
```

## Após rodar

Os outputs ficam em `graphify-out/`:
- `graph.html` — grafo interativo, abrir no browser
- `GRAPH_REPORT.md` — relatório com god nodes e conexões
- `graph.json` — dados do grafo (persistente)

## Consultar o grafo depois (sem reconstruir)

```
/graphify query "como funciona o sistema de billing?"
/graphify query "quais componentes usam a API de PIX?"
/graphify path "billing" "HomeView"
/graphify explain "computeCurrentCycle"
```
