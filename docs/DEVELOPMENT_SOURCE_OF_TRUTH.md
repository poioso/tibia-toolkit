# Development source of truth

The active development workspace is:

`C:\Users\monte\Documents\Tibiatoolkit App Producao`

Run the desktop application for feature work and local validation only with:

```cmd
cd /d "C:\Users\monte\Documents\Tibiatoolkit App Producao"
"C:\Users\monte\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\monte\Documents\Tibiatoolkit App Producao\node_modules\electron\cli.js" .
```

`Tibia Toolkit Open Source` is the public-release staging repository. Do not
develop independently in this checkout. Before a release, transfer only the
reviewed, public-safe runtime changes from the active workspace, preserve the
release tooling in this repository, build an installer locally, and verify the
packaged files before publishing.

Never use historical folders or installed application files as release source.
They are test artifacts, not development truth.
