import test from "node:test";
import assert from "node:assert/strict";
import { getFixedGridVirtualWindow } from "../../lib/ui/fixed-grid-virtualization.js";

test("calcula colunas e espacos para um grid fixo", () => {
  const result = getFixedGridVirtualWindow({
    totalItems: 200,
    viewportWidth: 242,
    viewportHeight: 138,
    paddingInline: 12,
    itemWidth: 42,
    itemHeight: 42,
    columnGap: 4,
    rowGap: 4,
    overscanRows: 2
  });

  assert.equal(result.columns, 5);
  assert.equal(result.totalRows, 40);
  assert.equal(result.firstIndex, 0);
  assert.equal(result.endIndex, 25);
  assert.equal(result.topSpacerHeight, 0);
  assert.equal(result.bottomSpacerHeight, 1606);
});

test("mantem uma margem curta antes e depois do viewport ao rolar", () => {
  const result = getFixedGridVirtualWindow({
    totalItems: 200,
    viewportWidth: 242,
    viewportHeight: 138,
    scrollTop: 460,
    paddingInline: 12,
    itemWidth: 42,
    itemHeight: 42,
    columnGap: 4,
    rowGap: 4,
    overscanRows: 2
  });

  assert.equal(result.startRow, 8);
  assert.equal(result.endRow, 15);
  assert.equal(result.firstIndex, 40);
  assert.equal(result.endIndex, 75);
  assert.equal(result.topSpacerHeight, 364);
  assert.equal(result.bottomSpacerHeight, 1146);
});

test("limita a janela maxima do Stash a 19 por 15 cards", () => {
  const result = getFixedGridVirtualWindow({
    totalItems: 6178,
    viewportWidth: 776,
    viewportHeight: 533,
    itemWidth: 38,
    itemHeight: 38,
    columnGap: 3,
    rowGap: 3,
    targetRenderedRows: 15
  });

  assert.equal(result.columns, 19);
  assert.equal(result.endIndex - result.firstIndex, 285);
});

test("lida com um grid vazio e uma largura ainda indisponivel", () => {
  const result = getFixedGridVirtualWindow({ totalItems: 0, viewportWidth: 0, viewportHeight: 0 });

  assert.equal(result.columns, 1);
  assert.equal(result.totalRows, 0);
  assert.equal(result.firstIndex, 0);
  assert.equal(result.endIndex, 0);
  assert.equal(result.topSpacerHeight, 0);
  assert.equal(result.bottomSpacerHeight, 0);
});
