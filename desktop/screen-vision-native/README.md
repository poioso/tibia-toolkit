# Screen Vision Native Host

Base nativa para o `Screen Vision`.

## Objetivo

Esta pasta prepara a camada Windows que o Electron nao consegue reproduzir sozinho com fidelidade:

- deteccao real da janela do Tibia
- leitura de foco, visibilidade e estado de maximizado/minimizado
- interop de `DWM thumbnail`
- canal local para o app principal conversar com o helper

## Por que existe

A ferramenta de referencia usa arquitetura nativa do Windows para a parte de espelho. A implementacao anterior baseada so em `desktopCapturer` + `getUserMedia` + `canvas` nao seguia essa mesma linha tecnica.

## Estado atual

- projeto WPF inicial criado
- pipe local inicial criado
- comando `ping` inicial pronto
- comando `getTibiaWindow` inicial pronto
- structs e imports de DWM preparados

## Proximas etapas

1. criar os comandos para abrir e fechar janelas espelho nativas
2. registrar thumbnails DWM por regiao
3. sincronizar auto hide/show com foco e estado do Tibia
4. ligar o Electron a esse host por IPC local
