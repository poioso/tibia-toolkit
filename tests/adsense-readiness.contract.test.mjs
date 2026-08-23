import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AdSense readiness requires a live approved PT-BR editorial inventory and never publishes records", async () => {
  const [audit, sitemap, editorialRoute, detailRoute, bookRoute, accountLayout] = await Promise.all([
    readFile(new URL("../tools/audit-adsense-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../site/app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../prototypes/auth-foundation/app/api/product/library-editorial/route.js", import.meta.url), "utf8"),
    readFile(new URL("../site/app/LibraryDetailRoute.tsx", import.meta.url), "utf8"),
    readFile(new URL("../site/app/biblioteca/livros-e-documentos/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../site/app/conta/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(audit, /readPublishedEditorialInventory/);
  assert.match(audit, /publishedPtBrIndexable/);
  assert.match(audit, /editorialInventory\.available/);
  assert.match(audit, /publishedEditorialRecords\.length > 0/);
  assert.match(audit, /automaticPublication:\s*"admin_authorized_audited_batch"/);
  assert.match(audit, /it cannot publish an editorial record/);
  assert.doesNotMatch(audit, /fetch\([^\n]+library-editorial[^\n]+method:\s*["'](?:POST|PATCH)/);

  assert.match(sitemap, /getPublishedLibraryEditorialRecords/);
  assert.match(editorialRoute, /locale='pt-BR' AND state='published'/);
  assert.match(editorialRoute, /audit_passed_at IS NOT NULL/);
  assert.match(editorialRoute, /reviewed_at IS NOT NULL/);
  assert.match(detailRoute, /robots:\s*editorial\?\.indexable/);
  assert.match(bookRoute, /robots:\s*editorial\?\.indexable/);
  assert.match(accountLayout, /index:\s*false, follow:\s*true/);
});
