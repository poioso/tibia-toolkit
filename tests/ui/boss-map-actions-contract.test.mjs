import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");

test("a ficha de todo boss reserva o ponto de montagem para mapa e rota do Hub", () => {
  const start = source.indexOf("function renderMonsterLocationSection(detail) {");
  const end = source.indexOf("\nfunction renderBossLocationMapActions", start);
  const body = source.slice(start, end);

  assert.match(body, /const mapActions = \(isBossDetail \|\| detail\.map\?\.url\)/);
});

test("a linha de mapa so aparece quando acervo ou Tracker fornece uma acao", () => {
  const start = source.indexOf("function syncBossMapActions(detail = {}, bossTracker = null, mapActions = null) {");
  const end = source.indexOf("\nfunction hasBossRouteMap", start);
  const body = source.slice(start, end);

  assert.match(body, /const hasRoute = hasBossRouteMap\(bossTracker\?\.routeMap\);/);
  assert.match(body, /mapActions\.classList\.toggle\("hidden", !locationUrl && !hasRoute\);/);
  assert.match(source, /boss-map-action-row\$\{locationUrl \? "" : " hidden"\}/);
});
