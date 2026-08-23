const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_KINDS = Object.freeze(["items", "npcs", "creatures", "bosses", "books"]);
const APP_INTEGRATION_IDS = new Set(["market-offers", "gear-recommendations", "boss-tracker"]);

const text = (value, maximum = 160) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

function invalid(reason) {
  return { valid: false, reason, contract: null };
}

function normalizeSection(section, allowedTypes, templateId) {
  const id = text(section?.id, 80);
  const type = text(section?.type, 80);
  const source = text(section?.source, 300);
  const titleKey = text(section?.titleKey, 120);
  const attachments = Array.isArray(section?.attachments)
    ? section.attachments.map((entry) => text(entry, 200)).filter(Boolean)
    : [];
  if (!id || !type || !source) throw new Error(`invalid-section:${templateId}`);
  if (!allowedTypes.has(type)) throw new Error(`unsupported-block:${type}`);
  return { id, type, source, ...(titleKey ? { titleKey } : {}), ...(attachments.length ? { attachments } : {}) };
}

function normalizeIntegration(anchor, templateId) {
  const id = text(anchor?.id, 80);
  const owner = text(anchor?.owner, 20);
  const after = text(anchor?.after, 80);
  if (!id || owner !== "app" || !after || !APP_INTEGRATION_IDS.has(id)) {
    throw new Error(`invalid-integration:${templateId}:${id || "unknown"}`);
  }
  return { id, owner, after };
}

export function validateLibraryPresentationContract(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("missing-contract");
  if (Number(raw.schemaVersion) !== SUPPORTED_SCHEMA_VERSION) return invalid("unsupported-schema-version");
  const allowedTypes = new Set(Array.isArray(raw.allowedBlockTypes) ? raw.allowedBlockTypes.map((entry) => text(entry, 80)).filter(Boolean) : []);
  if (!allowedTypes.size) return invalid("missing-block-types");
  const inputTemplates = raw.templates && typeof raw.templates === "object" && !Array.isArray(raw.templates) ? raw.templates : null;
  if (!inputTemplates) return invalid("missing-templates");

  try {
    const templates = {};
    for (const kind of SUPPORTED_KINDS) {
      const template = inputTemplates[kind];
      if (!template || typeof template !== "object" || Array.isArray(template)) throw new Error(`missing-template:${kind}`);
      const id = text(template.id, 100);
      const extendsKind = text(template.extends, 30);
      if (!id) throw new Error(`missing-template-id:${kind}`);
      if (extendsKind && (!SUPPORTED_KINDS.includes(extendsKind) || extendsKind === kind)) throw new Error(`invalid-template-parent:${kind}`);
      const sections = Array.isArray(template.sections)
        ? template.sections.map((section) => normalizeSection(section, allowedTypes, id))
        : [];
      if (!sections.length && !extendsKind) throw new Error(`missing-sections:${kind}`);
      const duplicate = sections.find((section, index) => sections.findIndex((candidate) => candidate.id === section.id) !== index);
      if (duplicate) throw new Error(`duplicate-section:${kind}:${duplicate.id}`);
      const integrationAnchors = Array.isArray(template.integrationAnchors)
        ? template.integrationAnchors.map((anchor) => normalizeIntegration(anchor, id))
        : [];
      templates[kind] = { id, ...(extendsKind ? { extends: extendsKind } : {}), sections, integrationAnchors };
    }

    const assetPolicy = raw.assetPolicy && typeof raw.assetPolicy === "object" ? raw.assetPolicy : {};
    const allowedRoots = Array.isArray(assetPolicy.allowedRoots)
      ? assetPolicy.allowedRoots.map((entry) => text(entry, 240)).filter((entry) => entry.startsWith("assets/"))
      : [];
    if (!allowedRoots.length || assetPolicy.remoteRendering !== false || assetPolicy.hashAlgorithm !== "sha256") {
      return invalid("unsafe-asset-policy");
    }

    return {
      valid: true,
      reason: "ok",
      contract: {
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        source: "site",
        runtimePolicy: {
          mode: "offline-first",
          startup: "use-last-verified-snapshot",
          networkFailure: "keep-current-snapshot",
          unknownBlock: "keep-data-and-use-safe-fallback",
          firstInstall: "installer-baseline"
        },
        allowedBlockTypes: [...allowedTypes],
        assetPolicy: { ...assetPolicy, allowedRoots },
        templates
      }
    };
  } catch (error) {
    return invalid(error?.message || "invalid-contract");
  }
}

export function resolveLibraryPresentationTemplate(contract, kind, visited = new Set()) {
  const normalizedKind = text(kind, 30);
  const template = contract?.templates?.[normalizedKind];
  if (!template || visited.has(normalizedKind)) return null;
  visited.add(normalizedKind);
  const parent = template.extends ? resolveLibraryPresentationTemplate(contract, template.extends, visited) : null;
  const sections = template.sections?.length ? template.sections : parent?.sections || [];
  return {
    id: template.id,
    sections,
    integrationAnchors: template.integrationAnchors?.length
      ? template.integrationAnchors
      : parent?.integrationAnchors || []
  };
}

export const LIBRARY_PRESENTATION_SCHEMA_VERSION = SUPPORTED_SCHEMA_VERSION;
