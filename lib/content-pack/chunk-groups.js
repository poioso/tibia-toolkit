const NON_RUNTIME_ASSET_PREFIXES = ["tibia-client/organized/"];
const RUNTIME_ASSET_EXCEPTIONS = new Set([
  "tibia-client/organized/client-ui/images/taskboard/icon-weeklytasks.png",
  "tibia-client/organized/objects/items/painting-equipment/artist-s-palette--item-3133.png"
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
    && pathExtension(normalized) !== ".jpeg"
    && (!NON_RUNTIME_ASSET_PREFIXES.some((prefix) => normalized.startsWith(prefix)) || RUNTIME_ASSET_EXCEPTIONS.has(normalized));
}

export function getContentPackChunkGroup(entryName) {
  const relative = normalizeContentPackRelativePath(entryName);

  if (relative.startsWith("data/items/") || relative.startsWith("data/item-atlases/")) return "library-media-items";
  if (relative.startsWith("data/creatures/")) return "library-media-creatures";
  if (relative.startsWith("data/npcs/")) return "library-media-npcs";
  if (relative.startsWith("data/spells/")) return "library-media-spells";
  if (relative.startsWith("data/library-thumbnails/")) return "library-media-thumbnails";
  if (relative.startsWith("data/books-documents/")) return "library-media-books";

  const file = relative.split("/").pop() || "";
  if (relative.startsWith("data/")) {
    if (/^(item-|item_|library-sprite-paths|site-library-canonical)/.test(file)) return "library-data-items";
    if (/^(creature-|boss-)/.test(file)) return "library-data-creatures";
    if (/^npc-/.test(file)) return "library-data-npcs";
    if (/^(books-documents|book-)/.test(file)) return "library-data-books";
    if (/^spells\./.test(file)) return "library-data-spells";
    if (relative.startsWith("data/mini-world-changes/")) return "mini-world-change-assets";
  }

  if (relative.startsWith("ui/tutorial/")) return "ui-tutorial-assets";
  if (relative.startsWith("ui/supporters/")) return "ui-supporter-assets";
  if (relative.startsWith("ui/tools/")) return "ui-tool-assets";
  if (relative.startsWith("ui/")) return "ui-core-assets";

  if (relative.startsWith("tibia-client/sheets/")) return "client-sprite-sheets";
  if (relative === "tibia-client/appearance-map.json" || relative === "tibia-client/sprite-appearance-map.json") {
    return "client-appearance-maps";
  }
  if (relative.startsWith("tibia-client/")) return "client-runtime-assets";

  return "core-and-other-assets";
}

function pathExtension(value) {
  const file = String(value || "").split("/").pop() || "";
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(dot).toLowerCase() : "";
}
