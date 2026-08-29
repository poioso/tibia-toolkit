const CORE_ASSET_ROOTS = new Set([
  "bestiary", "common", "economy", "feedback", "flags", "navigation",
  "spell-filters", "vocations", "window-controls", "world-status"
]);

export function normalizeContentPackRelativePath(entryName) {
  return String(entryName || "")
    .replaceAll("\\", "/")
    .replace(/^\/?assets\//, "");
}

export function isContentPackRuntimeAsset(relativePath) {
  const normalized = normalizeContentPackRelativePath(relativePath);
  return Boolean(normalized)
    && !normalized.endsWith("/.gitkeep")
    && !normalized.endsWith(".gitkeep")
    && pathExtension(normalized) !== ".jpeg";
}

export function getContentPackChunkGroup(entryName) {
  const relative = normalizeContentPackRelativePath(entryName);

  if (relative.startsWith("library/items/") && !relative.startsWith("library/catalogs/")) return "library-media-items";
  if (relative.startsWith("library/creatures/sprites/")) return "library-media-creatures";
  if (relative.startsWith("library/npcs/sprites/")) return "library-media-npcs";
  if (relative.startsWith("library/spells/")) return "library-media-spells";
  if (relative.startsWith("library/thumbnails/")) return "library-media-thumbnails";
  if (relative.startsWith("library/books/documents/")) return "library-media-books";
  if (relative.startsWith("library/navigation/") || relative.startsWith("library/npcs/icons/") || relative.startsWith("library/tasks/")) return "ui-core-assets";
  if (relative.startsWith("mini-world-changes/")) return "mini-world-change-assets";

  const file = relative.split("/").pop() || "";
  if (relative.startsWith("library/catalogs/")) {
    if (/^(item-|item_|library-sprite-paths|site-library-canonical)/.test(file)) return "library-data-items";
    if (/^(creature-|boss-)/.test(file)) return "library-data-creatures";
    if (/^npc-/.test(file)) return "library-data-npcs";
    if (/^(books-documents|book-)/.test(file)) return "library-data-books";
    if (/^spells\./.test(file)) return "library-data-spells";
  }

  if (relative.startsWith("tutorial/")) return "ui-tutorial-assets";
  if (relative.startsWith("monetization/")) return "ui-supporter-assets";
  if (relative.startsWith("tools/") || relative.startsWith("settings/")) return "ui-tool-assets";

  if (relative.startsWith("sprite-sheets/images/")) return "client-sprite-sheets";
  if (relative === "sprite-sheets/maps/appearance-map.json" || relative === "sprite-sheets/maps/sprite-appearance-map.json") {
    return "client-appearance-maps";
  }
  if (relative.startsWith("sprite-sheets/")) return "client-runtime-assets";

  if (CORE_ASSET_ROOTS.has(relative.split("/")[0])) return "ui-core-assets";

  return "core-and-other-assets";
}

function pathExtension(value) {
  const file = String(value || "").split("/").pop() || "";
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(dot).toLowerCase() : "";
}
