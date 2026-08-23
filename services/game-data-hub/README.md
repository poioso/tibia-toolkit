# Poioso Game Data Hub

Servico separado para centralizar na Hospedainfo os dados externos que nao sao market puro.

## Objetivo

Em vez do app consultar cada site diretamente, o Hub central passa a:

- puxar dados externos
- normalizar
- salvar em disco
- expor endpoints HTTP simples para o app

Fluxo:

```txt
fontes externas -> game-data-hub na Hospedainfo -> app/site
```

## O que esta implementado nesta primeira leva

### TibiaStatistic

- `GET /api/game/worlds/statistics`
  - combina:
    - `/statistics/worlds/data`
    - `/statistics/worlds/trends`
    - `/statistics/worlds/aggregates`
    - `/statistics/worlds/active-levels`
- `GET /api/game/bosses/worlds/{worldSlug}`
  - lista de bosses do mundo
- `GET /api/game/bosses/worlds/{worldSlug}/{bossSlug}`
  - detalhe do boss com ultima vez visto, chance e estatisticas de ocorrencia

### TibiaData

- A rota legada `GET /api/game/boosted` usa os endpoints publicos atuais:
  - `GET /v4/creatures` para o Boosted Creature
  - `GET /v4/boostablebosses` para o Boosted Boss

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
- `GET /api/game/tibiadata/news-ticker/archive?locale=pt-BR|en|de`
  - arquivo persistente e independente, apenas com `type: ticker`
  - usa a mesma coleta e tradução das notícias, sem compartilhar IDs, estado ou conteúdo com News/Articles
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

### Mini World Changes

- `GET /api/game/mini-world-changes/worlds/{world}`
  - recorte publico minimo de um mundo, sem nova consulta externa nem metadados de origem

O snapshot completo, o catalogo coletado e o status detalhado sao superficies
administrativas. Fora do loopback, elas exigem `Authorization: Bearer` com o
segredo privado `GAME_DATA_HUB_INTERNAL_TOKEN`; sem autorizacao respondem como
rota inexistente. A rota publica por mundo aplica lista branca de campos,
headers defensivos e limite por IP. O Hub nao envia CORS permissivo.

Configuracao opcional:

- `GAME_DATA_HUB_INTERNAL_TOKEN`: acesso administrativo fora do loopback;
- `GAME_DATA_HUB_MWC_RATE_WINDOW_MS`: janela do rate limit, padrao `60000`;
- `GAME_DATA_HUB_MWC_RATE_MAX`: requisicoes por IP/janela, padrao `90`;
- `GAME_DATA_HUB_TRUST_PROXY`: confiar no primeiro `X-Forwarded-For` somente
  quando o Hub estiver inacessivel diretamente e atras de proxy controlado.

O coletor usa `Europe/Berlin`, portanto acompanha automaticamente CET e CEST.
Ele roda uma vez as `10:10` e outra as `10:30` no horario europeu, depois do
Server Save global das `10:00`. Cada rodada consulta todos os mundos com duas
requisicoes HTTP agrupadas ao TibiaTrade. App e site leem somente o snapshot
persistente da Hospedainfo; visitas nunca disparam consultas na fonte.

Na primeira inicializacao sem snapshot, o Hub faz uma coleta unica de bootstrap.
As janelas concluidas ficam registradas no estado para impedir repeticao apos
reinicio do processo.

### Ativacao segura sem interromper clientes instalados

1. Publicar primeiro somente este hardening no Hub atual. A rota publica por
   mundo continua compativel, mas entrega apenas `name`, `displayName` e o nome
   canonico da Mini World Change. Nenhum provedor, URL externa, ID de coleta ou
   metadado operacional sai na resposta.
2. Configurar `GAME_DATA_HUB_INTERNAL_TOKEN` apenas no ambiente privado da VPS e
   no processo servidor do site. Nunca colocar o token no renderer, no pacote
   de conteudo ou no repositorio.
3. Em uma versao posterior do desktop, migrar a base para um dominio HTTPS do
   Toolkit protegido por proxy/WAF. Manter a rota legada apenas durante a janela
   de atualizacao dos clientes.
4. Somente depois de confirmar a adocao da versao HTTPS, bloquear a porta direta
   no firewall e exigir autenticacao no acesso de servidor para servidor.

Headers `Origin`, `Referer` e `User-Agent` nao autenticam um aplicativo desktop:
qualquer cliente pode falsifica-los. Segredos fixos embarcados no instalador
tambem podem ser extraidos. Por isso a protecao efetiva combina resposta minima,
cache privado, HTTPS, proxy/WAF, rate limit, segredo somente no servidor e
rotacao/revogacao quando houver identidade de usuario ou dispositivo.

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
- preservar listas ordenadas e nao ordenadas: cada `<li>` continua independente, na mesma ordem e no mesmo nivel; a traducao nao pode unir itens, transforma-los em paragrafos nem criar marcadores textuais, pois os marcadores pertencem ao HTML;
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

## Arquivos de deploy da Oracle 1

- config Oracle 1: [config.oracle1.example.json](</C:/Users/monte/Documents/Tibia/services/game-data-hub/config.oracle1.example.json:1>)
- unit `systemd`: [poioso-game-data-hub.service.example](</C:/Users/monte/Documents/Tibia/services/game-data-hub/poioso-game-data-hub.service.example:1>)
- unit do tunel reverso: [poioso-game-data-hub-tunnel.service.example](</C:/Users/monte/Documents/Tibia/services/game-data-hub/poioso-game-data-hub-tunnel.service.example:1>)

## Deploy isolado na Oracle 1

Padrao pensado para nao misturar com o `market-cache` que ja roda la:

- app: `/opt/poioso-game-data-hub`
- estado: `/var/lib/poioso-game-data-hub/state.json`
- snapshots: `/var/lib/poioso-game-data-hub/snapshots`
- browsers do Playwright: `/var/lib/poioso-game-data-hub/playwright`
- unit: `/etc/systemd/system/poioso-game-data-hub.service`
- tunel reverso opcional: `/etc/systemd/system/poioso-game-data-hub-tunnel.service`
- porta: `4318`

Com isso:

- o `poioso-market-cache.service` continua intacto
- o `game-data-hub` ganha config, storage e processo proprios
- o app pode consumir a Oracle 1 sem falar direto com os sites externos

## Como verificar ao vivo

```powershell
npm run verify:game-data-hub
```
