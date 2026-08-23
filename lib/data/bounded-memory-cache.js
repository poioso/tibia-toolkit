const DEFAULT_MAX_ENTRIES = 256;

export function createBoundedMemoryCache(options = {}) {
  const configuredMaxEntries = Number(options.maxEntries);
  const maxEntries = Number.isInteger(configuredMaxEntries) && configuredMaxEntries > 0
    ? configuredMaxEntries
    : DEFAULT_MAX_ENTRIES;
  const entries = new Map();

  function set(key, value) {
    if (entries.has(key)) {
      entries.delete(key);
    }

    entries.set(key, value);

    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      entries.delete(oldestKey);
    }

    return cache;
  }

  function get(key) {
    if (!entries.has(key)) {
      return undefined;
    }

    const value = entries.get(key);
    entries.delete(key);
    entries.set(key, value);
    return value;
  }

  const cache = {
    get,
    set,
    has: (key) => entries.has(key),
    delete: (key) => entries.delete(key),
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    }
  };

  return cache;
}

