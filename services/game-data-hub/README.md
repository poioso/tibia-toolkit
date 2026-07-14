# Poioso Game Data Hub

Servico separado para centralizar na Oracle 1 os dados externos que nao sao market puro.

## Objetivo

Em vez do app consultar cada site diretamente, a Oracle 1 passa a:

- puxar dados externos
- normalizar
- salvar em disco
- expor endpoints HTTP simples para o app

Fluxo:

```txt
fontes externas -> game-data-hub na Oracle 1 -> app
```

## O que esta implementado nesta primeira leva

### TibiaStatistic

- `GET /api/game/worlds/statistics`
  - combina:
    - `/statistics/worlds/data`
    - `/statistics/worlds/trends`
    - `/statistics/worlds/aggregates`
    - `/statistics/worlds/active-levels`
- `GET /api/game/boosted`
  - boosted creature
  - boosted boss
- `GET /api/game/bosses/worlds/{worldSlug}`
  - lista de bosses do mundo
- `GET /api/game/bosses/worlds/{worldSlug}/{bossSlug}`
  - detalhe do boss com ultima vez visto, chance e estatisticas de ocorrencia

### TibiaData

- `GET /api/game/tibiadata/worlds`
  - lista geral dos mundos com players online, localizacao e tipo PvP
- `GET /api/game/tibiadata/worlds/{world}`
  - detalhe do mundo, incluindo lista de personagens online
- `GET /api/game/tibiadata/worlds/{world}/guilds`
  - lista de guildas do mundo
- `GET /api/game/tibiadata/guild?name=...`
  - detalhe de uma guilda com membros online/offline
- `GET /api/game/tibiadata/worlds/{world}/houses?town=...`
  - lista de houses e guildhalls por cidade
- `GET /api/game/tibiadata/worlds/{world}/houses/{houseId}`
  - detalhe da house, dono, aluguel e status de auction/transfer
- `GET /api/game/tibiadata/worlds/{world}/killstatistics`
  - estatisticas de mortes/kills por criatura no mundo
- `GET /api/game/tibiadata/highscores?world=...&category=...&vocation=...&page=...`
  - highscores paginados
- `GET /api/game/tibiadata/news?days=14&limit=15`
  - fonte de noticias do Tibia; mantem os padroes compactos do app
  - aceita consulta de semeadura para consumidores proprios com ate `days=180` e `limit=200`
- `GET /api/game/tibiadata/news/{id}`
  - noticia completa
- `GET /api/game/tibiadata/news/archive?locale=pt-BR|en|de`
  - arquivo persistente do fansite, apenas com `type: news`
  - semeia 15 noticias completas na primeira coleta e conserva as anteriores ao acrescentar novidades
- `GET /api/game/tibiadata/character?name=...`
  - detalhe do personagem com deaths e outros chars da conta

### Char Bazaar

- `GET /api/game/bazaar/current?...`
  - lista paginada dos auctions atuais
  - por padrao usa `Exevopan` para a listagem enriquecida
  - quando entram filtros mais especificos, faz fallback para a visao do `tibia.com`
- `GET /api/game/bazaar/history?...`
  - lista paginada do historico de auctions
  - por padrao usa `Tibia do Zero`
  - pagina via `?page=...` direto na fonte deles
  - quando entram filtros mais especificos, faz fallback para a visao do `tibia.com`
- `GET /api/game/bazaar/auction/{auctionId}?subtopic=currentcharactertrades`
  - detalhe completo do auction
  - continua vindo do `tibia.com` via Playwright, porque ainda e a fonte mais rica para detalhe
  - inclui blocos paginados internos do tibia.com:
    - items
    - store items
    - mounts
    - store mounts
    - outfits
    - store outfits
    - familiars
    - blessings
    - imbuements
    - charms
    - map areas
    - quest lines
    - titles
    - achievements
    - bestiary progress

### Rookie / Rookstat

- `GET /api/game/rook/worlds`
- `GET /api/game/rook/characters/trending`
- `GET /api/game/rook/characters?...`
- `GET /api/game/rook/characters/{id}`
- `GET /api/game/rook/characters/{id}/forecast`
- `GET /api/game/rook/characters/{id}/activity`

## Endpoints de servico

- `GET /healthz`
- `GET /status`
- `GET /api/game/status`

## Cache e armazenamento

Os snapshots ficam em:

- `services/game-data-hub/data/state.json`
- `services/game-data-hub/data/snapshots/*.json`

Cada endpoint salva:

- payload normalizado
- horario do ultimo fetch
- horario da ultima tentativa
- erro mais recente, se houver
- origem

## Refresh padrao

O hub nao atualiza tudo por minuto cegamente. O padrao inicial ficou:

- worlds/boosted: `1 min`
- TibiaData worlds: `1 min`
- guilds / houses / kills / highscores / news / characters: `5 min`
- bazaar current: `5 min`
- bazaar history: `15 min`
- bazaar detail: `30 min`
- listas do Rookie: `5 min`
- boss world/detail: `15 min`
- detalhe de personagem rook: `10 min`

Se um endpoint for aberto sem cache, ele busca na hora.
Se existir cache antigo, ele devolve o cache e dispara refresh em segundo plano.

## Noticias: coleta e traducao

Regra para a tela de noticias do fansite:

- o arquivo persistente do Hub filtra `type: news`, portanto nao publica `news ticker`;
- na primeira coleta ele grava ate 15 noticias completas no seu proprio disco; nas coletas seguintes acrescenta somente as novas e preserva as anteriores;
- detalhes e traducoes ficam cacheados por noticia e idioma nos snapshots do Hub; trocar idioma ou recarregar a pagina nao repete uma traducao ja armazenada;
- o HTML e reconstruido apenas pelos seus nos de texto: links, URLs, imagens, `src`, atributos, classes, estilos e a posicao de cada imagem permanecem intactos;
- a traducao usa a API da OpenAI somente quando `OPENAI_API_KEY` estiver configurada no processo do Hub. Opcionalmente, `OPENAI_TRANSLATION_MODEL` escolhe o modelo (padrao `gpt-5-mini`).
- preservar integralmente HTML, links, URLs, imagens, `src`, atributos, classes, estilos e a posicao de cada imagem. Apenas nos de texto podem ser traduzidos;
- nao traduzir nomes canonicos de itens, criaturas/bosses, NPCs/pessoas, locais, quests/missoes, mundos, servidores ou outros nomes proprios de Tibia;
- para o ingles, reutilizar o texto original quando ele ja vier em ingles. Para os demais idiomas, traduzir somente o texto ainda nao cacheado, em lote pequeno e com o provedor mais barato disponivel.

## O que ainda nao entrou nesta primeira leva

- raspagem direta do `tibia.com` quando a fonte estruturada nao cobre
- fontes que dependem de contornar challenge do Cloudflare

Motivo:

- nos testes atuais, o `tibia.com` respondeu com challenge do Cloudflare para character trade
- para houses e guilds, o TibiaData ja cobre bem e entrou nesta segunda leva
- para char bazaar, a composicao atual ficou:
  - lista atual: `Exevopan`
  - historico: `Tibia do Zero`
  - detalhe: `tibia.com` via Playwright
- a arquitetura do hub ja ficou pronta para plugar as fontes restantes sem refazer o servico

## Como rodar

```powershell
npm run start:game-data-hub
```

## Exemplo de deploy isolado

- config base: [config.example.json](config.example.json)
- unit `systemd`: [tibia-toolkit-game-data-hub.service.example](tibia-toolkit-game-data-hub.service.example)

Use uma conta de servico dedicada e caminhos proprios do ambiente, por exemplo:

- app: `/opt/tibia-toolkit-game-data-hub`
- configuracao privada: `/etc/tibia-toolkit-game-data-hub/config.json`
- estado: `/var/lib/tibia-toolkit-game-data-hub/state.json`
- snapshots: `/var/lib/tibia-toolkit-game-data-hub/snapshots`
- navegadores do Playwright: `/var/lib/tibia-toolkit-game-data-hub/playwright`
- unit: `/etc/systemd/system/tibia-toolkit-game-data-hub.service`
- porta interna: `4318`

Nao publique IPs de producao, chaves SSH, tunel reverso, credenciais ou arquivos de ambiente. Se for expor o servico, use um dominio HTTPS revisado e controles de acesso adequados.

## Como verificar ao vivo

```powershell
npm run verify:game-data-hub
```
