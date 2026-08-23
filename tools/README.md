## Tibia client sprite extraction

## Organização

- `tools/library/`: exportação, sincronização, auditoria e contratos da Biblioteca.
- `tools/discord-server-bootstrap/`: runtime e publicação controlada do Discord.
- `tools/supporters-admin/`: operação de apoiadores.
- `tools/pc-migration-assistant/`: migração local do PC.
- arquivos ainda na raiz de `tools/`: legado aguardando migração por domínio.

Entrypoints antigos da Biblioteca permanecem como redirecionadores. Comandos e
implementações novas devem usar `tools/library/`.

This workspace includes a local extractor that reads the Tibia client assets in read-only mode and writes PNGs only inside this project.

Example:

```powershell
python tools/extract_tibia_sprites.py `
  --assets-dir "G:\Tibia\packages\Tibia\assets" `
  --limit 8 `
  --split
```

Outputs:

- `assets/tibia-client/sheets`
- `assets/tibia-client/split`
- `assets/tibia-client/sprite-sheet-manifest.json`

The script does not modify any file under `G:\Tibia`.

Notes:

- The current client catalog has `4927` sprite sheet entries and about `216189` split sprite IDs.
- If you omit `--limit`, the script extracts the full sprite sheet catalog.
- For the extension UI, the fastest path is still to use the item `image_src` exposed by Tibia Prices.
- The local extractor is most useful when we want an official-looking fallback asset pack stored inside the project.
