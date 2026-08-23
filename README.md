# Poioso Market Toolkit

App desktop overlay para consulta de itens, NPCs, criaturas, bosses e ferramentas do ecossistema Tibia.

## Site oficial do projeto

- fonte local: `site/`
- producao: [https://tibiatoolkit.com](https://tibiatoolkit.com)
- operacao, deploy, traducao automatica e recuperacao:
  [docs/TIBIA_TOOLKIT_SITE_RUNBOOK.md](docs/TIBIA_TOOLKIT_SITE_RUNBOOK.md)

## O que ja funciona

- abertura como app desktop sempre no topo via `Electron`
- categorias:
  - `Precos dos Itens`
  - `Ferramentas`
  - `NPCs`
- filtro por mundo
- sprite do item
- pack local de sprites oficiais extraido do cliente em `assets/tibia-client`
- metricas de market com buy e sell
- lista de NPCs que compram
- lista de NPCs que vendem, quando existir
- itens relacionados
- historico local de itens recentes
- conversao basica entre:
  - `gold`
  - `Tibia Coin`
  - `Gold Token`
- calculadora de imbuement
- comparacao automatica entre rota por `gold` e rota por `Gold Token`
- lista de ingredientes com sprite e atalho para abrir cada item
- controle de opacidade no overlay desktop
- layout desktop simplificado, com foco em `Preco` e `Imbuement`

## Como abrir o app desktop

1. No terminal, dentro desta pasta, rode:

```text
npm install
npm start
```

2. O app vai abrir:

- sempre sobreposto ao Windows
- com botao de minimizar e fechar
- com slider de opacidade no topo
- com largura pequena, pensada para ficar como overlay lateral

## Observacoes desta fase

- os sheets oficiais locais ficam descritos em `assets/tibia-client/sprite-sheet-manifest.json`
- a camada de dados do app fica em `lib/data/data-service.js`
- o cache/API propria de market fica em `services/market-cache/README.md`
