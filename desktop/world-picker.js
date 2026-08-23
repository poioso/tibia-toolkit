(() => {
  const query = document.querySelector("#query");
  const list = document.querySelector("#list");
  let worlds = [];
  let activeIndex = 0;

  function render() {
    const needle = query.value.trim().toLocaleLowerCase();
    const matches = worlds.filter((world) => !needle || String(world.name || "").toLocaleLowerCase().includes(needle));
    activeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, matches.length - 1)));
    list.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nenhum mundo encontrado.";
      list.append(empty);
      return matches;
    }
    matches.forEach((world, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `world${index === activeIndex ? " active" : ""}`;
      const name = document.createElement("strong");
      name.textContent = String(world.name || "-");
      const meta = document.createElement("div");
      meta.className = "meta";
      if (world.updatedLabel) {
        const updated = document.createElement("span");
        updated.textContent = world.updatedLabel;
        meta.append(updated);
      }
      if (world.battleyeIcon) {
        const icon = document.createElement("img");
        icon.src = `../${world.battleyeIcon}`;
        icon.alt = String(world.battleyeLabel || "");
        icon.title = String(world.battleyeLabel || "");
        meta.append(icon);
      }
      if (world.pvpLabel) {
        const pvp = document.createElement("span");
        pvp.textContent = world.pvpLabel;
        meta.append(pvp);
      }
      button.append(name, meta);
      button.addEventListener("mouseenter", () => {
        activeIndex = index;
        list.querySelectorAll(".world").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
      });
      button.addEventListener("click", () => window.worldPicker.select(world.slug));
      list.append(button);
    });
    return matches;
  }

  query.addEventListener("input", () => {
    activeIndex = 0;
    render();
  });
  query.addEventListener("keydown", (event) => {
    const matches = render();
    if (event.key === "Escape") {
      event.preventDefault();
      window.worldPicker.close();
    } else if (event.key === "ArrowDown" && matches.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      render();
    } else if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      render();
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      window.worldPicker.select(matches[activeIndex].slug);
    }
  });

  window.worldPicker.onRender((payload) => {
    const selectedSlug = String(payload.selectedSlug || "");
    worlds = Array.isArray(payload.worlds) ? payload.worlds.slice() : [];
    worlds.sort((left, right) => {
      if (left.slug === selectedSlug) return -1;
      if (right.slug === selectedSlug) return 1;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
    query.placeholder = String(payload.placeholder || "Digite o mundo");
    query.value = "";
    activeIndex = 0;
    render();
    query.focus();
  });
})();
