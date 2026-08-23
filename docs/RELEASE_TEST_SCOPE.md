# Escopo dos testes públicos da release

O repositório público testa o runtime distribuído: Electron, preloads, popups,
tutoriais, Native Host, updater, contratos de interface e armazenamento local.

Os testes que dependem do site Next.js, protótipos de autenticação, Market Cache
de servidor ou da árvore completa de assets não entram nesta árvore por
isolamento. Eles são executados na origem de desenvolvimento com os assets do
checkpoint e novamente pelos gates do Content Pack e do `win-unpacked`.

Isso evita transformar a ausência intencional de `site/`, protótipos, serviços de
servidor ou assets que serão baixados no Content Pack em uma falsa aprovação.
