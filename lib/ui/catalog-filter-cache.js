function hasSameReferences(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createCatalogFilterCache() {
  let source = null;
  let dependencies = [];
  let signature = "";
  let items = [];

  return {
    get({ source: nextSource, dependencies: nextDependencies = [], signature: nextSignature, buildItems }) {
      if (
        source === nextSource &&
        signature === nextSignature &&
        hasSameReferences(dependencies, nextDependencies)
      ) {
        return items;
      }

      items = buildItems();
      source = nextSource;
      dependencies = [...nextDependencies];
      signature = nextSignature;
      return items;
    },
    clear() {
      source = null;
      dependencies = [];
      signature = "";
      items = [];
    }
  };
}
