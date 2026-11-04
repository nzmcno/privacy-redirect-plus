// ui.js
// Site toggles and Quick Access links shared by the popup and options page

import { CATEGORIZED_QUICK_LINKS, SITES, hasInstances, isSiteEnabled, pickInstance } from "./redirects.js";

let pendingWrite = Promise.resolve();

// Queued so toggling two sites in quick succession can't overwrite one of the changes
function saveSiteEnabled(site, enabled) {
  pendingWrite = pendingWrite
    .then(async () => {
      const { customMap = {} } = await chrome.storage.sync.get("customMap");

      site.hosts.forEach((host) => {
        if (enabled) {
          delete customMap[host];
        } else {
          customMap[host] = "";  // Empty string means disabled
        }
      });

      await chrome.storage.sync.set({ customMap });
    })
    .catch((error) => console.error("Error saving settings:", error));
}

export async function renderSiteToggles(container) {
  const { customMap = {} } = await chrome.storage.sync.get("customMap");

  container.innerHTML = "";

  SITES.forEach((site) => {
    const available = hasInstances(site);

    const row = document.createElement("label");
    row.className = "toggle-row";

    const siteLabel = document.createElement("span");
    siteLabel.textContent = site.name;

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = available && isSiteEnabled(site, customMap);
    toggle.disabled = !available;
    toggle.addEventListener("change", () => saveSiteEnabled(site, toggle.checked));

    if (!available) {
      row.classList.add("unavailable");
      row.title = `No working ${site.service} instance right now, so ${site.name} is not redirected`;
      siteLabel.textContent = `${site.name} (no instance available)`;
    }

    row.appendChild(siteLabel);
    row.appendChild(toggle);
    container.appendChild(row);
  });
}

export function renderQuickLinks(container) {
  container.innerHTML = "";

  for (const [category, services] of Object.entries(CATEGORIZED_QUICK_LINKS)) {
    const categorySection = document.createElement("div");
    categorySection.className = "quickaccess-category";

    const categoryHeader = document.createElement("h3");
    categoryHeader.className = "category-title";
    categoryHeader.textContent = category;
    categorySection.appendChild(categoryHeader);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "category-buttons";

    services.forEach((service) => {
      const btn = document.createElement("button");
      btn.className = "quicklink-button";
      btn.textContent = service;
      btn.title = `Open a ${service} instance`;
      btn.onclick = () => window.open(pickInstance(service), "_blank");
      buttonsContainer.appendChild(btn);
    });

    categorySection.appendChild(buttonsContainer);
    container.appendChild(categorySection);
  }
}
