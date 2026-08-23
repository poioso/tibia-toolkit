function toPositiveNumber(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function toNonNegativeNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

/**
 * Calculates a bounded DOM window for a fixed-size CSS grid. The caller keeps
 * the full scroll height with top/bottom spacer rows, so filters, order and
 * scroll position remain identical while off-screen cells do not exist.
 */
export function getFixedGridVirtualWindow(options = {}) {
  const totalItems = Math.max(0, Math.floor(toNonNegativeNumber(options.totalItems)));
  const itemWidth = toPositiveNumber(options.itemWidth, 42);
  const itemHeight = toPositiveNumber(options.itemHeight, itemWidth);
  const columnGap = toNonNegativeNumber(options.columnGap, 4);
  const rowGap = toNonNegativeNumber(options.rowGap, columnGap);
  const paddingInline = toNonNegativeNumber(options.paddingInline, 0);
  const viewportWidth = toNonNegativeNumber(options.viewportWidth, itemWidth);
  const viewportHeight = toNonNegativeNumber(options.viewportHeight, itemHeight);
  const scrollTop = toNonNegativeNumber(options.scrollTop);
  const overscanRows = Math.floor(toNonNegativeNumber(options.overscanRows, 3));
  const targetRenderedRows = Math.floor(toNonNegativeNumber(options.targetRenderedRows));

  const availableWidth = Math.max(itemWidth, viewportWidth - paddingInline);
  const columns = Math.max(1, Math.floor((availableWidth + columnGap) / (itemWidth + columnGap)));
  const totalRows = Math.ceil(totalItems / columns);
  const rowStride = itemHeight + rowGap;
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowStride));
  const maximumStartRow = Math.max(0, totalRows - 1);
  const firstVisibleRow = Math.min(maximumStartRow, Math.floor(scrollTop / rowStride));
  const hasTargetWindow = targetRenderedRows > 0;
  const windowRows = hasTargetWindow
    ? Math.min(totalRows, Math.max(visibleRows, targetRenderedRows))
    : null;
  const startRow = hasTargetWindow
    ? Math.min(
        Math.max(0, totalRows - windowRows),
        Math.max(0, firstVisibleRow - Math.floor((windowRows - visibleRows) / 2))
      )
    : Math.max(0, firstVisibleRow - overscanRows);
  const endRow = hasTargetWindow
    ? Math.min(totalRows, startRow + windowRows)
    : Math.min(totalRows, firstVisibleRow + visibleRows + overscanRows);
  const firstIndex = startRow * columns;
  const endIndex = Math.min(totalItems, endRow * columns);
  const beforeRows = startRow;
  const afterRows = Math.max(0, totalRows - endRow);

  return {
    columns,
    totalRows,
    startRow,
    endRow,
    firstIndex,
    endIndex,
    topSpacerHeight: beforeRows > 0 ? beforeRows * rowStride - rowGap : 0,
    bottomSpacerHeight: afterRows > 0 ? afterRows * rowStride - rowGap : 0
  };
}
