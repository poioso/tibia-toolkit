# Tibia Toolkit - Guia de Atualizacoes

Este documento e a fonte de verdade para gerar, testar, publicar e limpar atualizacoes do Tibia Toolkit.

## Uso obrigatorio por qualquer agente ou chat

Antes de gerar ou publicar qualquer versao, o agente responsavel deve ler este documento inteiro e seguir todas as etapas na ordem descrita. Nenhuma versao pode pular o beta, ser recompilada entre beta e publico, substituir silenciosamente um numero ja publicado ou alterar por versao o link usado pelo site e Discord.

Se houver conflito entre uma instrucao improvisada e este protocolo, interromper a publicacao e confirmar a decisao com o responsavel pelo projeto. Correcoes urgentes tambem devem receber um novo numero de versao e passar pelo beta.

## Regra principal

1. Nunca publicar uma versao nova diretamente no canal publico.
2. Gerar o instalador uma unica vez e publicar primeiro no canal beta.
3. Validar download, instalacao, reabertura e preservacao dos dados no app instalado.
4. Promover exatamente os mesmos arquivos validados para o canal publico, sem recompilar.
5. Manter somente a versao atual e, quando necessario, uma versao anterior para rollback.

## Canais e destinos

### Hospedainfo - unica infraestrutura operacional

- Host/IP: `138.117.217.99`
- Raiz: `/opt/freelapilot/deploy/vps/public/tibia-toolkit`
- Publico: `/opt/freelapilot/deploy/vps/public/tibia-toolkit/updates`
- Beta: `/opt/freelapilot/deploy/vps/public/tibia-toolkit/updates-beta`
- Dominio principal: `https://downloads.tibiatoolkit.com`
- Alias de compatibilidade: `https://downloads-backup.tibiatoolkit.com`

Os dois dominios sao atendidos pelo mesmo Caddy e pela mesma arvore fisica na
Hospedainfo. Oracle 2 nao faz mais parte do fluxo de publicacao, atualizacao ou
rollback. Nao enviar novos artefatos para a Oracle 2.

O servico `tibia-toolkit-github-sync.timer` verifica a release publica mais
recente do GitHub a cada dez minutos. Quando encontra uma versao nova, baixa o
instalador e o blockmap em area temporaria, valida tamanho, SHA-512 e SHA-256,
promove `latest.yml` por ultimo e conserva somente a versao atual mais uma
anterior para rollback. Uma falha de validacao mantem o canal publico anterior
intacto.

## Link permanente de download público

Depois de o workflow publicar e validar o asset estável, o site, Discord, landing pages e materiais públicos devem usar sempre este endereço, sem número de versão:

`https://github.com/poioso/tibia-toolkit/releases/latest/download/Tibia-Toolkit-Setup.exe`

O trecho `/releases/latest/` é resolvido pelo GitHub para a release pública mais recente. Para isso funcionar, toda release deve incluir um asset chamado exatamente `Tibia-Toolkit-Setup.exe`, byte a byte idêntico ao instalador versionado e assinado.

Nunca colocar no site ou Discord um nome de arquivo versionado, uma URL de `updates-beta`, um caminho local da VPS ou uma URL específica como `v0.3.1`. O link público só muda se o repositório ou o nome fixo do produto mudar.

### Evidência do SignPath

O SignPath Foundation deve receber uma URL imutável da release analisada, por exemplo:

`https://github.com/poioso/tibia-toolkit/releases/tag/v0.3.1`

Nunca usar `/releases/latest/` em candidatura, auditoria ou solicitação de assinatura, porque esse destino muda com a próxima release. O asset de nome fixo é exclusivo para usuários finais.

### Canais de atualização já instalados

O atualizador interno continua consultando `downloads.tibiatoolkit.com` e
`downloads-backup.tibiatoolkit.com`. Os dois domínios são aliases da mesma
árvore na Hospedainfo. Depois que uma release pública aparece no GitHub, o timer
da Hospedainfo baixa e valida os artefatos e atualiza esse canal
automaticamente. Esses domínios não são o link divulgado no site ou Discord.

## Antes de gerar

- Confirmar que `package.json` e `package-lock.json` possuem a mesma versao.
- Atualizar `RELEASE_NOTES.md` com o fallback em ingles.
- Atualizar `RELEASE_NOTES.i18n.json` em `pt-BR`, `en` e `de`.
- Rodar `node --check` nos arquivos JavaScript alterados.
- Rodar `git diff --check`.
- Nao incluir arquivos sujos ou nao relacionados no commit.
- Nao alterar o canal publico antes da validacao beta.

## Build isolado do aplicativo

Para uma atualizacao que nao altera o pacote grande de conteudo:

```powershell
node tools/generate-app-icon.mjs
node node_modules/electron-builder/cli.js --config desktop/electron-builder.json --win nsis
node tools/finalize-update-manifest.mjs
```

Nao usar o build completo de conteudo quando somente o executavel mudou. Os assets grandes possuem ciclo de distribuicao separado.

Arquivos gerados em `dist/tibia-toolkit-release`:

- `Tibia Toolkit Setup X.Y.Z.exe`
- `Tibia Toolkit Setup X.Y.Z.exe.blockmap`
- `latest.yml`

## Validacao local obrigatoria

- Confirmar a versao do `latest.yml`.
- Confirmar que o tamanho do executavel coincide com o manifesto.
- Recalcular SHA-512 e comparar com `sha512` do manifesto.
- Confirmar `releaseNotesByLocale` com `pt-BR`, `en` e `de`.
- Confirmar que o instalador foi gerado com o icone correto.

## Publicacao beta atomica

Executar o procedimento somente na Hospedainfo:

1. Enviar o `.exe` com o nome final versionado.
2. Enviar o `.blockmap` com o nome final versionado.
3. Enviar o manifesto como `latest.yml.next`.
4. Conferir remotamente o tamanho do `.exe`.
5. Somente depois mover `latest.yml.next` para `latest.yml`.

Nunca trocar o manifesto antes de o executavel e o blockmap estarem completos e
validados na Hospedainfo.

## Teste beta

Para testar em uma instalacao local, alterar somente o arquivo instalado:

`%LOCALAPPDATA%\Programs\Tibia Toolkit\resources\app\desktop\app-config.json`

Apontar temporariamente `updateUrls` para:

- `https://downloads.tibiatoolkit.com/updates-beta`
- `https://downloads-backup.tibiatoolkit.com/updates-beta`

Nao alterar `desktop/app-config.json` do projeto para beta. O instalador final deve continuar configurado para o canal publico.

Validar, nesta ordem:

1. O aviso de nova versao aparece.
2. O idioma do aviso e das notas segue o idioma ativo.
3. O download inicia uma unica vez.
4. O progresso visual acompanha o download.
5. O aviso final aparece sem cortes ou barra de rolagem.
6. A instalacao fecha todos os processos do Toolkit sem matar o instalador.
7. O app reabre na versao nova.
8. Perfis, configuracoes e conteudo local continuam intactos.
9. Os dois dominios de compatibilidade respondem com os mesmos bytes.

### Regra do encerramento antes da instalacao

O aplicativo possui um encerramento assíncrono para fechar o Native Host e as
demais janelas auxiliares. Quando `electron-updater` chama
`quitAndInstall()`, ele passa a ser o dono do encerramento: o atualizador deve
marcar o estado `appUpdateQuitRequested` antes da chamada, e o listener de
`before-quit` deve deixar esse evento passar sem `preventDefault()` nem chamar
`appUpdaterController.install()` novamente. O instalador NSIS encerra os
processos remanescentes antes de substituir os arquivos.

O fluxo normal de fechamento, sem atualização, continua usando a limpeza
assíncrona e só chama `appUpdaterController.install()` depois que ela termina.
Essa separação é obrigatória: interceptar o `before-quit` do
`quitAndInstall()` pode deixar o executável baixado em `pending` sem concluir a
instalação, mesmo com o download em 100%.

## Promocao para o publico

Somente depois do aval do teste beta:

1. Copiar no servidor os mesmos `.exe`, `.blockmap` e `latest.yml` do beta para o publico.
2. Nao recompilar.
3. Atualizar `latest.yml` por ultimo e de forma atomica.
4. Confirmar por HTTP que os dois dominios servidos pela Hospedainfo retornam a nova versao.
5. Confirmar `Content-Length` do instalador nos dois dominios.
6. Confirmar que a release do GitHub contém o asset estável `Tibia-Toolkit-Setup.exe`, que ele possui o mesmo SHA-256 do instalador versionado e que a URL pública fixa retorna HTTP `200`.

Tambem abrir o botao `Patch Notes` ao lado do download no site e confirmar que
ele mostra a mesma versao e as mesmas notas localizadas do `latest.yml` publico.

## Publicacao obrigatoria dos patch notes

Depois da promocao publica e das validacoes acima, manter as mesmas notas
revisadas nestes pontos oficiais:

1. GitHub Release;
2. botao `Patch Notes` ao lado do download no site oficial;
3. canal `updates` do Discord oficial.

O botao `Patch Notes` nao usa `Noticias do Tibia Toolkit` e nao exige uma
noticia separada nem um deploy do site. Ele consulta `/api/patch-notes`, que le
o `updates/latest.yml` publico da Hospedainfo. Assim, toda versao publica deve:

- incluir `latest.yml` nos assets da GitHub Release;
- incluir `releaseNotesByLocale` em `pt-BR`, `en` e `de` no manifesto;
- aguardar o `tibia-toolkit-github-sync.timer` sincronizar e promover o
  manifesto na Hospedainfo;
- validar `/api/patch-notes?locale=pt-BR`, `en` e `de` antes do anuncio.

Nao publicar o anuncio no Discord enquanto a versao estiver em beta ou enquanto
o botao `Patch Notes` ainda mostrar a versao anterior.

### Discord

- Seguir `docs/DISCORD_RELEASE_PATCH_NOTES.md`.
- Postar em ingles no canal `updates`, como o bot configurado.
- Marcar `@everyone`.
- Ao final, mencionar o canal `downloads`.
- Conferir o canal ao vivo e impedir mensagens duplicadas.

Site e Discord devem continuar apontando para o link publico permanente, nunca
para beta, CDN interno, caminho local ou URL versionada do instalador.

## Retencao e limpeza

Depois de cada publicacao, listar os arquivos nos dois diretorios de updates da
Hospedainfo: publico e beta.

Politica de retencao:

- Canal publico: manter a versao publica atual e, durante uma liberacao recente, no maximo uma versao anterior para rollback.
- Canal beta: manter o beta atual e no maximo o beta anterior para rollback.
- Remover `.exe` e `.blockmap` de versoes mais antigas na Hospedainfo.
- Nunca remover o arquivo apontado pelo `latest.yml` atual.
- Nunca remover um rollback antes de validar a versao que o substituiu.

O objetivo e impedir acumulacao de instaladores antigos na Hospedainfo.

## Checklist final

- [ ] Sintaxe e `git diff --check` passaram.
- [ ] Build isolado concluido.
- [ ] SHA-512 e tamanho conferidos.
- [ ] Notas presentes em `pt-BR`, `en` e `de`.
- [ ] Commit contem somente a atualizacao planejada.
- [ ] Beta publicado de forma atomica na Hospedainfo.
- [ ] Instalacao e reabertura testadas.
- [ ] Dados locais preservados.
- [ ] Mesmo artefato beta promovido ao publico, sem rebuild.
- [ ] URLs publicas verificadas.
- [ ] Release do GitHub contém `Tibia-Toolkit-Setup.exe` com o mesmo SHA-256 do instalador versionado.
- [ ] URL pública fixa do GitHub retorna HTTP `200` para o asset estável da release atual.
- [ ] `latest.yml` da GitHub Release contem `releaseNotesByLocale` em `pt-BR`, `en` e `de`.
- [ ] Timer da Hospedainfo sincronizou e promoveu o novo `latest.yml` sem intervencao manual.
- [ ] Botao `Patch Notes` junto ao download mostra a versao publica atual em `pt-BR`, `en` e `de`.
- [ ] Patch notes publicados pelo bot no canal `updates` do Discord, em ingles, com `@everyone`.
- [ ] Post do Discord menciona corretamente o canal `downloads`.
- [ ] GitHub, site e Discord descrevem a mesma versao e as mesmas mudancas publicadas.
- [ ] Nenhum link do site ou Discord aponta para `updates-beta` ou para um nome de arquivo versionado.
- [ ] Evidência enviada ao SignPath usa a URL versionada e imutável da release, nunca `/releases/latest/`.
- [ ] Instaladores antigos removidos conforme a politica de retencao.

## Rollback

Se uma versao falhar antes da promocao, manter o canal publico intacto e voltar o `latest.yml` beta para a versao anterior preservada.

Se uma versao publica falhar, restaurar atomicamente o `latest.yml` publico
anterior na Hospedainfo e confirmar que o instalador apontado ainda existe.

Nunca tentar corrigir uma versao publicada substituindo silenciosamente um instalador com o mesmo numero. Sempre gerar uma nova versao.
