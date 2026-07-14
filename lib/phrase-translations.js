import { DEFAULT_LOCALE, normalizeLocale } from "./locale-state.js";

const phraseMapCache = new Map();
const PHRASE_OVERRIDES = {
  "pt-BR": {
    "Best buy": "Melhor compra",
    "Best sell": "Melhor venda",
    "Ingredientsdientes": "Ingredientes",
    "Session data": "Dados da sessão",
    "Session data:": "Dados da sessão:",
    "Use NPC price": "Usar preço de NPC",
    "View details": "Ver detalhes"
  },
  en: {
    "Abrir": "Open",
    "Abrir Buy me a Coffee": "Open Buy me a Coffee",
    "Abrir painel de magias": "Open spell panel",
    "Abrir painel lateral de Alertas.": "Open Alerts side panel.",
    "Abrir painel lateral de Perfis.": "Open Profiles side panel.",
    "Abrir painel lateral de SQM Finder.": "Open SQM Finder side panel.",
    "Abrir seletor de cor.": "Open color picker.",
    "Ajustar a altura da barra.": "Adjust the bar height.",
    "Ajustar a largura da barra.": "Adjust the bar width.",
    "Ajustar a opacidade do espelho.": "Adjust mirror opacity.",
    "Ajustar o arredondamento da barra.": "Adjust the bar rounding.",
    "Ajustar o volume deste alerta.": "Adjust this alert volume.",
    "Ajustar o volume global de todos os alertas.": "Adjust the global volume of all alerts.",
    "Ativar som": "Enable sound",
    "Cancelar": "Cancel",
    "Clique para trocar a hotkey.": "Click to change the hotkey.",
    "Compre Tibia Coins com desconto": "Buy Tibia Coins with a discount",
    "Confirmar": "Confirm",
    "Criar espelho manual": "Create manual mirror",
    "Criar nova magia": "Create new spell",
    "Criar um novo timer de alerta.": "Create a new alert timer.",
    "Criando perfil...": "Creating profile...",
    "Copiar nome": "Copy name",
    "Copie o texto e envie ao NPC": "Copy the text and send it to the NPC",
    "Desativar todos os alertas visuais": "Disable all visual alerts",
    "Desativar todos os alertas sonoros": "Disable all sound alerts",
    "Editar": "Edit",
    "Editar alerta": "Edit alert",
    "Editar nome do espelho.": "Edit mirror name.",
    "Editar nome, tempo e hotkey.": "Edit name, time and hotkey.",
    "Escolher Perfil": "Choose profile",
    "Escolher audio do alerta": "Choose alert audio",
    "Escolher audio do alerta.": "Choose alert audio.",
    "Escolher o som que toca ao final do timer.": "Choose the sound that plays when the timer ends.",
    "Exportar perfil": "Export profile",
    "Fechar": "Close",
    "Fechar esta janela.": "Close this window.",
    "Fechar mapa": "Close map",
    "Fechar painel lateral": "Close side panel",
    "Fechar Buy me a Coffee": "Close Buy me a Coffee",
    "Fechar painel de magias": "Close spell panel",
    "Ferramentas": "Tools",
    "Fraqueza": "Schwäche",
    "Fraqueza": "Schwäche",
    "Fraqueza": "Weakness",
    "Ingredientes": "Ingredients",
    "Instrução": "Instruction",
    "Minimizar": "Minimize",
    "Mostrar": "Show",
    "Mostrar mundos": "Show worlds",
    "Mostrar itens": "Show items",
    "Mostrar guildas": "Show guilds",
    "Mostrar dias desde a ultima visita": "Show days since the last visit",
    "Mostrar datas do ciclo atual": "Show current cycle dates",
    "Mostrar espelho.": "Show mirror.",
    "Mostrar ou ocultar todos os espelhos.": "Show or hide all mirrors.",
    "Não perguntar novamente nas próximas 10 sessões": "Do not ask again for the next 10 sessions",
    "Nao perguntar novamente nas proximas 10 sessoes": "Do not ask again for the next 10 sessions",
    "NPCs/Criaturas": "NPCs/Creatures",
    "Ocultar espelho.": "Hide mirror.",
    "Ocultar": "Hide",
    "Selecionar audio": "Select audio",
    "Selecionar fraqueza": "Select weakness",
    "Preços dos Itens": "Item Prices",
    "Precos dos Itens": "Item Prices",
    "Novo perfil": "New profile",
    "Novo timer": "New timer",
    "Salvar": "Save",
    "Salvar timer": "Save timer",
    "Salvar perfil.": "Save profile.",
    "Atualizar timer": "Update timer",
    "Selecionar este perfil para trocar, exportar ou editar.": "Select this profile to switch, export or edit.",
    "Editar perfil.": "Edit profile.",
    "Duplicar perfil.": "Duplicate profile.",
    "Excluir perfil.": "Delete profile.",
    "Editar timer": "Edit timer",
    "Importar perfil": "Import profile",
    "Carregar audio proprio": "Load your own audio",
    "Store": "Store",
    "Selecionar idioma": "Select language",
    "Silenciar": "Mute",
    "Abrir documentaÃ§Ã£o das APIs": "Open API documentation",
    "Abrir item na aba de preços": "Open item in the prices tab",
    "Abrir item na aba de preÃ§os": "Open item in the prices tab",
    "Ativar ou desativar a grade.": "Enable or disable the grid.",
    "Fechar a janela de Alertas.": "Close the Alerts window.",
    "Ajustar o volume global de todos os timers.": "Adjust the global volume of all timers.",
    "Editar nome": "Edit name",
    "Renomear este timer.": "Rename this timer.",
    "Excluir este timer.": "Delete this timer.",
    "Mostrar um texto na tela quando o timer terminar.": "Show text on screen when the timer ends.",
    "Ajustar o volume deste timer.": "Adjust this timer volume.",
    "Texto que aparece na tela quando o alerta visual for usado.": "Text shown on screen when the visual alert is used.",
    "Escolher o tamanho do texto do alerta.": "Choose the alert text size.",
    "Escolher a fonte do texto do alerta.": "Choose the alert text font.",
    "Escolher a grossura do texto do alerta.": "Choose the alert text thickness.",
    "Renomear timer": "Rename timer",
    "Ativar ou desativar a barra de cooldown desta regiao.": "Enable or disable this region cooldown bar.",
    "Ajustar a espessura da barra.": "Adjust the bar thickness.",
    "Ajustar o comprimento da barra.": "Adjust the bar length.",
    "Escolher a posicao da barra.": "Choose the bar position.",
    "Escolher a direcao da barra.": "Choose the bar direction.",
    "Selecionar area": "Select area",
    "Salvar esta area selecionada.": "Save this selected area.",
    "Abrir o guia rapido desta ferramenta.": "Open this tool quick guide.",
    "Criar uma nova regiao manualmente.": "Create a new region manually.",
    "Abrir a janela externa de Alertas.": "Open the external Alerts window.",
    "Abrir personalizacao visual.": "Open visual customization.",
    "Abrir a grade overlay para alinhar a captura.": "Open the overlay grid to align the capture.",
    "Fechar a janela de personalizacao visual.": "Close the visual customization window.",
    "Usar preço de NPC": "Use NPC price",
    "Ver detalhes": "View details",
    "Ver detalhes do NPC": "View NPC details",
    "Você deseja fechar o aplicativo ou minimizar para a bandeja do sistema?":
      "Do you want to close the application or minimize it to the system tray?",
    "Voce deseja fechar o aplicativo ou minimizar para a bandeja do sistema?":
      "Do you want to close the application or minimize it to the system tray?",
    "Ajustar o volume global de todos os alertas.": "Adjust the global volume of all alerts.",
    "Ajustar o volume global de todos os alertas": "Adjust the global volume of all alerts.",
    "Ajustar o volume deste alerta.": "Adjust this alert volume.",
    "Session data": "Session data",
    "Dados da sessão": "Session data",
    "Dados da sessão:": "Session data:",
    "Ingredientesdientes": "Ingredients",
    "Melhor compra": "Best buy",
    "Melhor venda": "Best sell",
    "Carregando configuracao da regiao.": "Loading region configuration.",
    "Carregando espelho...": "Loading mirror...",
    "Carregando estatisticas do boss...": "Loading boss statistics...",
    "Carregando personagens do mundo...": "Loading world characters...",
    "Carregando mundos": "Loading worlds",
    "Preparando interface": "Preparing interface",
    "Buscando itens recentes": "Loading recent items",
    "Restaurando rascunhos": "Restoring drafts",
    "Recuperando ferramentas": "Restoring tools",
    "Lendo mundo salvo": "Reading saved world",
    "Organizando atalhos": "Organizing shortcuts",
    "Carregando catalogo local": "Loading local catalog",
    "Preparando criaturas": "Preparing creatures",
    "Carregando assets": "Loading assets",
    "Atualizando moedas": "Updating currencies",
    "Montando item inicial": "Building initial item",
    "Buscando precos do mercado": "Loading market prices",
    "Salvando preferencias": "Saving preferences",
    "Quase pronto": "Almost ready",
    "Montando comparação final...": "Building final comparison...",
    "Montando comparacao final...": "Building final comparison...",
    "Nenhum timer ainda": "No timer yet",
    "Iniciar ouvindo ao abrir": "Start listening on open",
    "Ao abrir esta janela, iniciar a escuta automaticamente se houver timers.": "When opening this window, start listening automatically if there are timers.",
    "Nenhuma estatistica adicional encontrada para este boss.": "No additional statistics found for this boss.",
    "Nenhuma recomendacao de equipamento encontrada para esta criatura.": "No equipment recommendation found for this creature.",
    "Nenhum item negociavel encontrado na base local.": "No tradable item found in the local database.",
    "Nenhum item comprado.": "No item bought.",
    "Nenhum item vendido.": "No item sold.",
    "Nenhum personagem encontrado com os filtros atuais.": "No character found with the current filters.",
    "Nenhum timer salvo ainda. Cadastre o primeiro no painel ao lado.": "No timer saved yet. Create the first one in the side panel.",
    "Nenhum item relacionado disponivel.": "No related item available.",
    "Nenhum atalho encontrado.": "No shortcut found.",
    "Nao ha itens de market no filtro atual para atualizar.": "There are no market items in the current filter to refresh.",
    "Voce deve aguardar um pouco antes de atualizar de novo.": "You need to wait a bit before refreshing again.",
    "Carregando preços de imbuement...": "Loading imbuement prices...",
    "Carregando market do stash...": "Loading stash market...",
    "Atualizando market do stash...": "Updating stash market...",
    "Carregando snapshot do market salvo...": "Loading saved market snapshot...",
    "Atualizacao de market interrompida.": "Market update interrupted.",
    "Falha ao consultar market.": "Failed to query the market.",
    "Interromper Carregamento": "Stop loading",
    "Falha ao abrir preview do item.": "Failed to open item preview.",
    "Nenhum NPC vendedor encontrado.": "No selling NPC found.",
    "Nenhum NPC comprador encontrado.": "No buying NPC found.",
    "Selecionar area": "Select area",
    "Confirmar area": "Confirm area",
    "Fechar janela": "Close window",
    "Minimizar janela": "Minimize window",
    "Salvar esta area selecionada.": "Save this selected area.",
    "Trave para ativar o alerta visual.": "Lock it to enable the visual alert.",
    "Assim que os dados do mundo fecharem, a sugestao aparece aqui.": "As soon as the world data is complete, the suggestion appears here.",
    "Digite o valor manual do Gold Token para fechar a comparacao.": "Enter the Gold Token manual value to complete the comparison.",
    "Este imbuement nao tem rota dedicada por Gold Token. A comparacao fica so no market.": "This imbuement has no dedicated Gold Token route. The comparison stays only on the market.",
    "Alguns ingredientes ainda nao possuem preco retornado nesta base para este mundo.": "Some ingredients still do not have a returned price in this database for this world.",
    "Crie seu Primeiro Espelho": "Create your first mirror",
    "Crie um Perfil": "Create a profile",
    "Escolha uma cor para salvar": "Choose a color to save",
    "Apague uma cor para salvar outra": "Delete a color to save another",
    "Destrave para poder editar.": "Unlock it to edit.",
    "Desative os Alertas sonoros para editar.": "Disable sound alerts to edit.",
    "Desative os Alertas visuais para editar.": "Disable visual alerts to edit.",
    "Desative o alerta visual para editar.": "Disable the visual alert to edit.",
    "Desative os alertas para editar.": "Disable the alerts to edit.",
    "Desative o alerta sonoro para editar.": "Disable the sound alert to edit.",
    "Abra o Tibia Maximisado para ligar": "Open Tibia maximized to enable it",
    "Crie um perfil primeiro": "Create a profile first",
    "Timer pronto": "Timer ready",
    "Clique em ADICIONAR TIMER para comecar": "Click ADD TIMER to start",
    "Iniciar ou parar a escuta das hotkeys.": "Start or stop hotkey listening.",
    "Cidade": "City",
    "Funcao": "Role",
    "Comercio": "Trade",
    "Compra/vende": "Buys/sells",
    "Sem comercio": "No trade",
    "Desconhecido": "Unknown",
    "Localizacao": "Location",
    "Sons": "Sounds",
    "Elementos": "Elements",
    "Atributos": "Attributes",
    "Compra": "Buy",
    "Venda": "Sell",
    "Itens negociaveis": "Tradable items",
    "Velocidade": "Speed",
    "Armadura": "Armor",
    "Mitigacao": "Mitigation",
    "Dificuldade": "Difficulty",
    "Ocorrencia": "Occurrence",
    "Ocupacao nao informada.": "Occupation not informed.",
    "Esse item pode ser comprado na Store.": "This item can be bought through the Store.",
    "Ele sera entregue no Seu Store Inbox em um Decoration Kit.": "It will be delivered to Your Store Inbox in a Decoration Kit.",
    "Ele sera entregue no Seu Store Inbox.": "It will be delivered to Your Store Inbox.",
    "Em casa de jogadores.": "In player houses."
    ,
    "Sem dados suficientes para recomendar a melhor rota de venda.": "Not enough data to recommend the best selling route.",
    "Melhor vender para": "Best to sell to",
    "Melhor vender pelo": "Best to sell through",
    "Empate entre": "Tie between",
    "ambos estao em": "both are at",
    "para venda rapida.": "for a quick sale.",
    "o buy offer atual esta em": "the current buy offer is at",
    "acima do melhor": "above the best",
    "paga": "pays",
    "e nao ha": "and there is no",
    "comprador melhor.": "better buyer.",
    "Sugestao: Melhor comprar via": "Suggestion: Best to buy via",
    "Market direto via": "Direct market via",
    "Rota Yana/NPC": "Yana/NPC route",
    "Economia estimada:": "Estimated savings:",
    "Compra mista: melhor pacote para os itens restantes foi": "Mixed purchase: the best package for the remaining items was",
    "Valor do Gold Token definido manualmente.": "Gold Token value set manually.",
    "com taxa do shrine": "with shrine fee",
    "Sem bundle": "No bundle",
    "Efeito:": "Effect:",
    "Compra mista": "Mixed purchase",
    "Inclui ou remove a taxa do shrine nos totais finais e na sugestao.": "Includes or removes the shrine fee from the final totals and the recommendation."
    ,
    "Party Hunt": "Party Hunt",
    "Solo Hunt": "Solo Hunt",
    "Resetar": "Reset",
    "Tipo de analyzer": "Analyzer type",
    "Importante:": "Important:",
    "Sessao": "Session",
    "Periodo": "Period",
    "Tipo": "Type",
    "Players": "Players",
    "Balance total": "Total balance",
    "Por pessoa": "Per person",
    "Lider": "Leader",
    "Loot": "Loot",
    "Supplies": "Supplies",
    "Balance": "Balance",
    "Damage": "Damage",
    "Healing": "Healing",
    "Texto do Hunt Analyzer solo": "Solo Hunt Analyzer text",
    "Cole aqui o texto copiado do Hunt Analyzer solo": "Paste the copied Solo Hunt Analyzer text here",
    "Nao consegui identificar uma party valida nesse texto.": "I could not identify a valid party in this text.",
    "Nao encontrei jogadores no padrao do Party Hunt Analyzer.": "I could not find players in the Party Hunt Analyzer pattern.",
    "Loot Type: Leader detectado. Preco otimizado ativo.": "Loot Type: Leader detected. Optimized price active.",
    "Loot Type: Leader detectado. Modo manual selecionado.": "Loot Type: Leader detected. Manual mode selected.",
    "Party Hunt usa os valores prontos do texto copiado. O tipo da sessao fica apenas como referencia.": "Party Hunt uses the values exactly as they came in the copied text. The session type is shown only as reference.",
    "deve pagar": "must pay",
    "para": "to",
    "Saldo total:": "Total balance:",
    "Numero de pessoas:": "Number of people:",
    "Saldo por pessoa:": "Balance per person:",
    "cada": "each",
    "Sem valor": "No value",
    "Total:": "Total:",
    "Evento Double": "Double event",
    "Double XP": "Double XP",
    "Double Loot": "Double Loot",
    "Exibir em": "Display in",
    "Imbuement": "Imbuement",
    "Escolha o imbuement": "Choose the imbuement",
    "Grade visual no estilo inventory": "Visual grid in inventory style",
    "Valor manual do Gold Token": "Manual Gold Token value",
    "Materiais via market": "Materials via market",
    "Taxa do shrine": "Shrine fee",
    "Total via gold": "Total via gold",
    "Total via gold token": "Total via gold token",
    "ADICIONAR TIMER": "ADD TIMER",
    "Volume:": "Volume:",
    "Guide": "Guide",
    "ADD REGION": "ADD REGION",
    "Grid": "Grid"
  },
  de: {
    "Abrir": "Öffnen",
    "Abrir Buy me a Coffee": "Buy me a Coffee öffnen",
    "Abrir painel de magias": "Zauberpanel öffnen",
    "Abrir painel lateral de Alertas.": "Alerts-Seitenpanel öffnen.",
    "Abrir painel lateral de Perfis.": "Profile-Seitenpanel öffnen.",
    "Abrir painel lateral de SQM Finder.": "SQM-Finder-Seitenpanel öffnen.",
    "Abrir seletor de cor.": "Farbauswahl öffnen.",
    "Ajustar a altura da barra.": "Höhe der Leiste anpassen.",
    "Ajustar a largura da barra.": "Breite der Leiste anpassen.",
    "Ajustar a opacidade do espelho.": "Deckkraft des Spiegels anpassen.",
    "Ajustar o arredondamento da barra.": "Abrundung der Leiste anpassen.",
    "Ajustar o volume deste alerta.": "Lautstärke dieses Alarms anpassen.",
    "Ajustar o volume global de todos os alertas.": "Globale Lautstärke aller Alarme anpassen.",
    "Ativar som": "Ton aktivieren",
    "Cancelar": "Abbrechen",
    "Clique para trocar a hotkey.": "Klicke, um den Hotkey zu ändern.",
    "Compre Tibia Coins com desconto": "Tibia Coins mit Rabatt kaufen",
    "Confirmar": "Bestätigen",
    "Criar espelho manual": "Manuellen Spiegel erstellen",
    "Criar nova magia": "Neuen Zauber erstellen",
    "Criar um novo timer de alerta.": "Einen neuen Alarm-Timer erstellen.",
    "Criando perfil...": "Profil wird erstellt...",
    "Copiar nome": "Name kopieren",
    "Copie o texto e envie ao NPC": "Kopiere den Text und sende ihn an den NPC",
    "Desativar todos os alertas visuais": "Alle visuellen Alarme deaktivieren",
    "Desativar todos os alertas sonoros": "Alle Tonalarme deaktivieren",
    "Editar": "Bearbeiten",
    "Editar alerta": "Alarm bearbeiten",
    "Editar nome do espelho.": "Spiegelnamen bearbeiten.",
    "Editar nome, tempo e hotkey.": "Name, Zeit und Hotkey bearbeiten.",
    "Escolher Perfil": "Profil auswählen",
    "Escolher audio do alerta": "Alarm-Audio wählen",
    "Escolher audio do alerta.": "Alarm-Audio wählen.",
    "Escolher o som que toca ao final do timer.": "Wähle den Ton, der am Ende des Timers abgespielt wird.",
    "Fechar": "Schließen",
    "Fechar esta janela.": "Dieses Fenster schließen.",
    "Fechar mapa": "Karte schließen",
    "Fechar painel lateral": "Seitenpanel schließen",
    "Fechar Buy me a Coffee": "Buy me a Coffee schließen",
    "Fechar painel de magias": "Zauberpanel schließen",
    "Ferramentas": "Tools",
    "Fraqueza": "Schwäche",
    "Ingredientes": "Zutaten",
    "Instrução": "Anleitung",
    "Minimizar": "Minimieren",
    "Mostrar": "Anzeigen",
    "Mostrar mundos": "Welten anzeigen",
    "Mostrar itens": "Items anzeigen",
    "Mostrar guildas": "Gilden anzeigen",
    "Mostrar dias desde a ultima visita": "Tage seit dem letzten Besuch anzeigen",
    "Mostrar datas do ciclo atual": "Aktuelle Zyklusdaten anzeigen",
    "Mostrar espelho.": "Spiegel anzeigen.",
    "Mostrar ou ocultar todos os espelhos.": "Alle Spiegel anzeigen oder ausblenden.",
    "Não perguntar novamente nas próximas 10 sessões": "In den nächsten 10 Sitzungen nicht erneut fragen",
    "Nao perguntar novamente nas proximas 10 sessoes": "In den nächsten 10 Sitzungen nicht erneut fragen",
    "NPCs/Criaturas": "NPCs/Kreaturen",
    "Ocultar espelho.": "Spiegel ausblenden.",
    "Ocultar": "Ausblenden",
    "Selecionar audio": "Audio auswählen",
    "Selecionar fraqueza": "Schwäche auswählen",
    "Preços dos Itens": "Item-Preise",
    "Precos dos Itens": "Item-Preise",
    "Novo perfil": "Neues Profil",
    "Novo timer": "Neuer Timer",
    "Salvar": "Speichern",
    "Salvar timer": "Timer speichern",
    "Salvar perfil.": "Profil speichern.",
    "Atualizar timer": "Timer aktualisieren",
    "Selecionar este perfil para trocar, exportar ou editar.": "Dieses Profil zum Wechseln, Exportieren oder Bearbeiten auswählen.",
    "Editar timer": "Timer bearbeiten",
    "Store": "Store",
    "Selecionar idioma": "Sprache auswählen",
    "Silenciar": "Stummschalten",
    "Abrir documentação das APIs": "API-Dokumentation öffnen",
    "Abrir item na aba de preços": "Item im Preis-Tab öffnen",
    "Abrir item na aba de preÃ§os": "Item im Preis-Tab öffnen",
    "Ativar ou desativar a grade.": "Raster aktivieren oder deaktivieren.",
    "Usar preço de NPC": "NPC-Preis verwenden",
    "Ver detalhes": "Details ansehen",
    "Ver detalhes do NPC": "NPC-Details ansehen",
    "Você deseja fechar o aplicativo ou minimizar para a bandeja do sistema?":
      "Möchtest du die Anwendung schließen oder in die Systemleiste minimieren?",
    "Voce deseja fechar o aplicativo ou minimizar para a bandeja do sistema?":
      "Möchtest du die Anwendung schließen oder in die Systemleiste minimieren?",
    "Ajustar o volume global de todos os alertas": "Globale Lautstärke aller Alarme anpassen.",
    "Session data": "Sitzungsdaten",
    "Dados da sessão": "Sitzungsdaten",
    "Dados da sessão:": "Sitzungsdaten:",
    "Ingredientesdientes": "Zutaten",
    "Melhor compra": "Bester Kauf",
    "Melhor venda": "Bester Verkauf",
    "Carregando configuracao da regiao.": "Regionseinstellungen werden geladen.",
    "Carregando espelho...": "Spiegel wird geladen...",
    "Carregando estatisticas do boss...": "Boss-Statistiken werden geladen...",
    "Carregando personagens do mundo...": "Welt-Charaktere werden geladen...",
    "Carregando mundos": "Welten werden geladen",
    "Preparando interface": "Oberflaeche wird vorbereitet",
    "Buscando itens recentes": "Letzte Items werden geladen",
    "Restaurando rascunhos": "Entwuerfe werden wiederhergestellt",
    "Recuperando ferramentas": "Tools werden wiederhergestellt",
    "Lendo mundo salvo": "Gespeicherte Welt wird gelesen",
    "Organizando atalhos": "Verknuepfungen werden organisiert",
    "Carregando catalogo local": "Lokaler Katalog wird geladen",
    "Preparando criaturas": "Kreaturen werden vorbereitet",
    "Carregando assets": "Assets werden geladen",
    "Atualizando moedas": "Waehrungen werden aktualisiert",
    "Montando item inicial": "Start-Item wird aufgebaut",
    "Buscando precos do mercado": "Marktpreise werden geladen",
    "Salvando preferencias": "Einstellungen werden gespeichert",
    "Quase pronto": "Fast fertig",
    "Montando comparação final...": "Finaler Vergleich wird erstellt...",
    "Montando comparacao final...": "Finaler Vergleich wird erstellt...",
    "Nenhum timer ainda": "Noch kein Timer",
    "Iniciar ouvindo ao abrir": "Beim Oeffnen mit Lauschen starten",
    "Ao abrir esta janela, iniciar a escuta automaticamente se houver timers.": "Beim Oeffnen dieses Fensters automatisch mit dem Lauschen starten, wenn Timer vorhanden sind.",
    "Nenhuma estatistica adicional encontrada para este boss.": "Keine zusaetzlichen Statistiken fuer diesen Boss gefunden.",
    "Nenhuma recomendacao de equipamento encontrada para esta criatura.": "Keine Ausruestungsempfehlung fuer diese Kreatur gefunden.",
    "Nenhum item negociavel encontrado na base local.": "Kein handelbares Item in der lokalen Datenbank gefunden.",
    "Nenhum item comprado.": "Kein gekauftes Item.",
    "Nenhum item vendido.": "Kein verkauftes Item.",
    "Nenhum personagem encontrado com os filtros atuais.": "Kein Charakter mit den aktuellen Filtern gefunden.",
    "Nenhum timer salvo ainda. Cadastre o primeiro no painel ao lado.": "Noch kein Timer gespeichert. Erstelle den ersten im Seitenpanel.",
    "Nenhum item relacionado disponivel.": "Kein verwandtes Item verfuegbar.",
    "Nenhum atalho encontrado.": "Keine Verknuepfung gefunden.",
    "Nao ha itens de market no filtro atual para atualizar.": "Es gibt keine Markt-Items im aktuellen Filter zum Aktualisieren.",
    "Voce deve aguardar um pouco antes de atualizar de novo.": "Du musst kurz warten, bevor du erneut aktualisierst.",
    "Carregando preços de imbuement...": "Imbuement-Preise werden geladen...",
    "Carregando market do stash...": "Stash-Markt wird geladen...",
    "Atualizando market do stash...": "Stash-Markt wird aktualisiert...",
    "Carregando snapshot do market salvo...": "Gespeicherter Markt-Snapshot wird geladen...",
    "Atualizacao de market interrompida.": "Markt-Aktualisierung wurde unterbrochen.",
    "Falha ao consultar market.": "Markt konnte nicht abgefragt werden.",
    "Interromper Carregamento": "Laden stoppen",
    "Falha ao abrir preview do item.": "Item-Vorschau konnte nicht geoeffnet werden.",
    "Nenhum NPC vendedor encontrado.": "Kein verkaufender NPC gefunden.",
    "Nenhum NPC comprador encontrado.": "Kein kaufender NPC gefunden.",
    "Selecionar area": "Bereich auswaehlen",
    "Confirmar area": "Bereich bestaetigen",
    "Fechar janela": "Fenster schliessen",
    "Minimizar janela": "Fenster minimieren",
    "Salvar esta area selecionada.": "Diesen ausgewaehlten Bereich speichern.",
    "Trave para ativar o alerta visual.": "Sperre es, um den visuellen Alarm zu aktivieren.",
    "Assim que os dados do mundo fecharem, a sugestao aparece aqui.": "Sobald die Weltdaten vollstaendig sind, erscheint der Hinweis hier.",
    "Digite o valor manual do Gold Token para fechar a comparacao.": "Gib den manuellen Gold-Token-Wert ein, um den Vergleich abzuschliessen.",
    "Este imbuement nao tem rota dedicada por Gold Token. A comparacao fica so no market.": "Dieses Imbuement hat keine eigene Gold-Token-Route. Der Vergleich bleibt nur beim Markt.",
    "Alguns ingredientes ainda nao possuem preco retornado nesta base para este mundo.": "Einige Zutaten haben in dieser Datenbank fuer diese Welt noch keinen Rueckgabepreis.",
    "Crie seu Primeiro Espelho": "Erstelle deinen ersten Spiegel",
    "Crie um Perfil": "Erstelle ein Profil",
    "Escolha uma cor para salvar": "Waehle eine Farbe zum Speichern",
    "Apague uma cor para salvar outra": "Loesche eine Farbe, um eine andere zu speichern",
    "Destrave para poder editar.": "Entsperre zum Bearbeiten.",
    "Desative os Alertas sonoros para editar.": "Deaktiviere die Tonalarme zum Bearbeiten.",
    "Desative os Alertas visuais para editar.": "Deaktiviere die visuellen Alarme zum Bearbeiten.",
    "Desative o alerta visual para editar.": "Deaktiviere den visuellen Alarm zum Bearbeiten.",
    "Desative os alertas para editar.": "Deaktiviere die Alarme zum Bearbeiten.",
    "Desative o alerta sonoro para editar.": "Deaktiviere den Tonalarm zum Bearbeiten.",
    "Abra o Tibia Maximisado para ligar": "Oeffne Tibia maximiert zum Aktivieren",
    "Crie um perfil primeiro": "Erstelle zuerst ein Profil",
    "Timer pronto": "Timer bereit",
    "Clique em ADICIONAR TIMER para comecar": "Klicke auf TIMER HINZUFUEGEN, um zu starten",
    "Iniciar ou parar a escuta das hotkeys.": "Hotkey-Erkennung starten oder stoppen.",
    "Cidade": "Stadt",
    "Funcao": "Rolle",
    "Comercio": "Handel",
    "Compra/vende": "Kauft/verkauft",
    "Sem comercio": "Kein Handel",
    "Desconhecido": "Unbekannt",
    "Localizacao": "Standort",
    "Sons": "Laute",
    "Elementos": "Elemente",
    "Atributos": "Attribute",
    "Compra": "Kauf",
    "Venda": "Verkauf",
    "Itens negociaveis": "Handelbare Items",
    "Velocidade": "Geschwindigkeit",
    "Armadura": "Ruestung",
    "Mitigacao": "Minderung",
    "Dificuldade": "Schwierigkeit",
    "Ocorrencia": "Vorkommen",
    "Ocupacao nao informada.": "Beruf nicht angegeben.",
    "Esse item pode ser comprado na Store.": "Dieses Item kann im Store gekauft werden.",
    "Ele sera entregue no Seu Store Inbox em um Decoration Kit.": "Es wird in dein Store-Inbox in einem Decoration Kit geliefert.",
    "Ele sera entregue no Seu Store Inbox.": "Es wird in dein Store-Inbox geliefert.",
    "Em casa de jogadores.": "In Spielerhaeusern."
    ,
    "Sem dados suficientes para recomendar a melhor rota de venda.": "Nicht genug Daten, um die beste Verkaufsroute zu empfehlen.",
    "Melhor vender para": "Am besten verkaufen an",
    "Melhor vender pelo": "Am besten verkaufen ueber",
    "Empate entre": "Gleichstand zwischen",
    "ambos estao em": "beide liegen bei",
    "para venda rapida.": "fuer einen schnellen Verkauf.",
    "o buy offer atual esta em": "das aktuelle Kaufangebot liegt bei",
    "acima do melhor": "ueber dem besten",
    "paga": "zahlt",
    "e nao ha": "und es gibt keinen",
    "comprador melhor.": "besseren Kaeufer.",
    "Sugestao: Melhor comprar via": "Empfehlung: Am besten kaufen ueber",
    "Market direto via": "Direkter Markt ueber",
    "Rota Yana/NPC": "Yana/NPC-Route",
    "Economia estimada:": "Geschaetzte Ersparnis:",
    "Compra mista: melhor pacote para os itens restantes foi": "Gemischter Kauf: Das beste Paket fuer die verbleibenden Items war",
    "Valor do Gold Token definido manualmente.": "Gold-Token-Wert wurde manuell festgelegt.",
    "com taxa do shrine": "mit Shrine-Gebuehr",
    "Sem bundle": "Kein Bundle",
    "Efeito:": "Effekt:",
    "Compra mista": "Gemischter Kauf",
    "Inclui ou remove a taxa do shrine nos totais finais e na sugestao.": "Fuegt die Shrine-Gebuehr zu den Endsummen und der Empfehlung hinzu oder entfernt sie."
    ,
    "Party Hunt": "Party Hunt",
    "Solo Hunt": "Solo Hunt",
    "Resetar": "Zuruecksetzen",
    "Tipo de analyzer": "Analyzer-Typ",
    "Importante:": "Wichtig:",
    "Sessao": "Sitzung",
    "Periodo": "Zeitraum",
    "Tipo": "Typ",
    "Players": "Spieler",
    "Balance total": "Gesamtsaldo",
    "Por pessoa": "Pro Person",
    "Lider": "Anfuehrer",
    "Loot": "Loot",
    "Supplies": "Supplies",
    "Balance": "Saldo",
    "Damage": "Schaden",
    "Healing": "Heilung",
    "Texto do Hunt Analyzer solo": "Solo-Hunt-Analyzer-Text",
    "Cole aqui o texto copiado do Hunt Analyzer solo": "Fuege hier den kopierten Solo-Hunt-Analyzer-Text ein",
    "Nao consegui identificar uma party valida nesse texto.": "Ich konnte in diesem Text keine gueltige Party erkennen.",
    "Nao encontrei jogadores no padrao do Party Hunt Analyzer.": "Ich konnte keine Spieler im Muster des Party Hunt Analyzer finden.",
    "Loot Type: Leader detectado. Preco otimizado ativo.": "Loot-Typ: Leader erkannt. Optimierter Preis ist aktiv.",
    "Loot Type: Leader detectado. Modo manual selecionado.": "Loot-Typ: Leader erkannt. Manueller Modus ausgewaehlt.",
    "Party Hunt usa os valores prontos do texto copiado. O tipo da sessao fica apenas como referencia.": "Party Hunt verwendet die Werte genau wie im kopierten Text. Der Sitzungstyp wird nur als Referenz angezeigt.",
    "deve pagar": "muss zahlen",
    "para": "an",
    "Saldo total:": "Gesamtsaldo:",
    "Numero de pessoas:": "Anzahl der Personen:",
    "Saldo por pessoa:": "Saldo pro Person:",
    "cada": "pro",
    "Sem valor": "Kein Wert",
    "Total:": "Gesamt:",
    "Evento Double": "Double-Event",
    "Double XP": "Double XP",
    "Double Loot": "Double Loot",
    "Exibir em": "Anzeigen in",
    "Imbuement": "Imbuement",
    "Escolha o imbuement": "Waehle das Imbuement",
    "Grade visual no estilo inventory": "Visuelles Raster im Inventory-Stil",
    "Valor manual do Gold Token": "Manueller Gold-Token-Wert",
    "Materiais via market": "Materialien ueber den Markt",
    "Taxa do shrine": "Shrine-Gebuehr",
    "Total via gold": "Gesamt ueber Gold",
    "Total via gold token": "Gesamt ueber Gold Token",
    "ADICIONAR TIMER": "TIMER HINZUFUEGEN",
    "Volume:": "Lautstaerke:",
    "Guide": "Anleitung",
    "ADD REGION": "REGION HINZUFUEGEN",
    "Grid": "Raster"
  }
};

const PHRASE_RULES = {
  en: [
    [/^Carregando (.+)\.\.\.$/i, (_match, value) => `Loading ${value}...`],
    [/^Atualizando (.+)\.\.\.$/i, (_match, value) => `Updating ${value}...`],
    [/^Falha ao carregar (.+)\.$/i, (_match, value) => `Failed to load ${value}.`],
    [/^Atualizado: (.+)$/i, (_match, value) => `Updated: ${value}`],
    [/^Pesa (.+) oz\.$/i, (_match, value) => `Weighs ${value} oz.`],
    [/^Adicionado: (.+)\.$/i, (_match, value) => `Added: ${value}.`],
    [/^Classifica(?:Ã§Ã£o|ção|cao): (.+)\. Max\. Tier: (.+)\.$/i, (_match, value, tier) => `Classification: ${value}. Max. Tier: ${tier}.`],
    [/^Mercado: Este item pode ser comercializado pelo Mercado\.$/i, () => "Market: This item can be traded on the Market."],
    [/^Pode ser usado por (.+?)(?: de level (.+?) ou superior)?\.$/i, (_match, vocation, level) => level ? `Can be used by ${vocation} from level ${level} onward.` : `Can be used by ${vocation}.`],
    [/^Pode ser usado corretamente(?: de level (.+?) ou superior)?\.$/i, (_match, level) => level ? `Can be used properly from level ${level} onward.` : "Can be used properly."],
    [/^Este NPC [ée\?] (.+)\.$/i, (_match, roles) => `This NPC is ${roles}.`],
    [/^(\S.*) itens exibidos\.$/i, (_match, count) => `${count} items shown.`],
    [/^(\S.*) itens exibidos\. Market: (\S.*)\/(\S.*?)( carregando\.\.\.)?$/i, (_match, count, loaded, total, loading) => `${count} items shown. Market: ${loaded}/${total}${loading ? " loading..." : ""}`],
    [/^(.+?) \| (.+?) ap(?:ó|o|\?)s filtros(?: \| share (.+?))?( \| carregando\.\.\.)?$/i, (_match, world, count, share, loading) => `${world} | ${count} after filters${share ? ` | share ${share}` : ""}${loading ? " | loading..." : ""}`],
    [/^Mostrando 120 de (.+) itens\.$/i, (_match, total) => `Showing 120 of ${total} items.`]
  ],
  de: [
    [/^Carregando (.+)\.\.\.$/i, (_match, value) => `${value} wird geladen...`],
    [/^Atualizando (.+)\.\.\.$/i, (_match, value) => `${value} wird aktualisiert...`],
    [/^Falha ao carregar (.+)\.$/i, (_match, value) => `${value} konnte nicht geladen werden.`],
    [/^Atualizado: (.+)$/i, (_match, value) => `Aktualisiert: ${value}`],
    [/^Pesa (.+) oz\.$/i, (_match, value) => `Wiegt ${value} oz.`],
    [/^Adicionado: (.+)\.$/i, (_match, value) => `Hinzugefuegt: ${value}.`],
    [/^Classifica(?:Ã§Ã£o|ção|cao): (.+)\. Max\. Tier: (.+)\.$/i, (_match, value, tier) => `Klassifizierung: ${value}. Max. Tier: ${tier}.`],
    [/^Mercado: Este item pode ser comercializado pelo Mercado\.$/i, () => "Markt: Dieses Item kann ueber den Markt gehandelt werden."],
    [/^Pode ser usado por (.+?)(?: de level (.+?) ou superior)?\.$/i, (_match, vocation, level) => level ? `Kann von ${vocation} ab Level ${level} verwendet werden.` : `Kann von ${vocation} verwendet werden.`],
    [/^Pode ser usado corretamente(?: de level (.+?) ou superior)?\.$/i, (_match, level) => level ? `Kann korrekt ab Level ${level} verwendet werden.` : "Kann korrekt verwendet werden."],
    [/^Este NPC [ée\?] (.+)\.$/i, (_match, roles) => `Dieser NPC ist ${roles}.`],
    [/^(\S.*) itens exibidos\.$/i, (_match, count) => `${count} Items angezeigt.`],
    [/^(\S.*) itens exibidos\. Market: (\S.*)\/(\S.*?)( carregando\.\.\.)?$/i, (_match, count, loaded, total, loading) => `${count} Items angezeigt. Markt: ${loaded}/${total}${loading ? " wird geladen..." : ""}`],
    [/^(.+?) \| (.+?) ap(?:ó|o|\?)s filtros(?: \| share (.+?))?( \| carregando\.\.\.)?$/i, (_match, world, count, share, loading) => `${world} | ${count} nach Filtern${share ? ` | share ${share}` : ""}${loading ? " | wird geladen..." : ""}`],
    [/^Mostrando 120 de (.+) itens\.$/i, (_match, total) => `120 von ${total} Items werden angezeigt.`]
  ]
};

export function decodeMojibakeText(value) {
  let text = String(value ?? "");

  for (let index = 0; index < 3 && /[ÃƒÃ‚Ã¢]/.test(text); index += 1) {
    try {
      text = decodeURIComponent(escape(text));
    } catch (_error) {
      break;
    }
  }

  return text;
}

export function normalizePhraseKey(value) {
  return decodeMojibakeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getPhraseAssetUrl(locale) {
  const normalizedLocale = normalizeLocale(locale);
  return new URL(`../assets/i18n/phrases.${normalizedLocale}.json`, import.meta.url);
}

function resolvePhraseMapBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.desktopApi?.data
    || window.screenVisionApi?.data
    || window.desktopApi?.screenVisionApi?.data
    || window.tutorialPopoverApi?.data
    || null
  );
}

function buildOverrideMap(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const entries = PHRASE_OVERRIDES[normalizedLocale] || {};

  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [normalizePhraseKey(key), value])
  );
}

function normalizePhrasePayloadEntries(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return Object.entries(payload).reduce((collection, [key, value]) => {
    const normalizedKey = normalizePhraseKey(key);

    if (!normalizedKey) {
      return collection;
    }

    collection[normalizedKey] = typeof value === "string"
      ? decodeMojibakeText(value)
      : value;
    return collection;
  }, {});
}

export async function loadPhraseTranslationMap(locale) {
  const normalizedLocale = normalizeLocale(locale);

  if (!phraseMapCache.has(normalizedLocale)) {
    phraseMapCache.set(
      normalizedLocale,
      (async () => {
        const bridge = resolvePhraseMapBridge();

        if (typeof bridge?.sendMessage === "function") {
          const payload = await bridge.sendMessage({
            type: "fetch-phrase-map",
            payload: { locale: normalizedLocale }
          }).catch(() => ({}));

          return {
            ...normalizePhrasePayloadEntries(payload),
            ...buildOverrideMap(normalizedLocale)
          };
        }

        if (typeof fetch !== "function") {
          return buildOverrideMap(normalizedLocale);
        }

        const response = await fetch(getPhraseAssetUrl(normalizedLocale)).catch(() => null);
        const payload = response?.ok
          ? await response.json().catch(() => ({}))
          : {};

        return {
          ...normalizePhrasePayloadEntries(payload),
          ...buildOverrideMap(normalizedLocale)
        };
      })()
        .catch(() => buildOverrideMap(normalizedLocale))
    );
  }

  return phraseMapCache.get(normalizedLocale);
}

export function translatePhraseSync(locale, value, phraseMap = {}) {
  const source = decodeMojibakeText(value);
  const direct = phraseMap[normalizePhraseKey(source)] ?? phraseMap[source];

  if (direct && direct !== source) {
    return direct;
  }

  const rules = PHRASE_RULES[normalizeLocale(locale)] || [];
  for (const [pattern, replacer] of rules) {
    if (!pattern.test(source)) {
      continue;
    }

    const nextText = typeof replacer === "function"
      ? source.replace(pattern, (...args) => replacer(...args.slice(0, -2)))
      : source.replace(pattern, replacer);

    if (nextText && nextText !== source) {
      return nextText;
    }
  }

  if (source.length >= 140) {
    const segments = source
      .split(/(?<=[.!?])\s+/)
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);

    if (segments.length > 1) {
      const translatedSegments = segments.map((segment) => translatePhraseSync(locale, segment, phraseMap));

      if (translatedSegments.some((segment, index) => segment !== segments[index])) {
        return translatedSegments.join(" ");
      }
    }
  }

  return direct || source;
}

export async function translatePhrase(locale, value) {
  const phraseMap = await loadPhraseTranslationMap(locale);
  return translatePhraseSync(locale, value, phraseMap);
}

export async function translateObjectTextFields(locale, source, fieldNames = []) {
  if (!source || typeof source !== "object") {
    return source;
  }

  const phraseMap = await loadPhraseTranslationMap(locale);
  const next = { ...source };

  for (const fieldName of fieldNames) {
    if (typeof next[fieldName] !== "string") {
      continue;
    }

    next[fieldName] = translatePhraseSync(locale, next[fieldName], phraseMap);
  }

  return next;
}
