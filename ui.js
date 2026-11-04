// ui.js
// Views shared by the popup and the options page

import { FARSIDE_ARCHIVE, FARSIDE_ARCHIVE_DATE } from "./archive.js";
import { INSTANCE_NOTES, PROJECTS, SOURCES } from "./catalog.js";
import {
  CATEGORIZED_QUICK_LINKS,
  INSTANCES,
  SITES,
  hasInstances,
  isSiteEnabled,
  parseInstanceUrl,
  pickInstance
} from "./redirects.js";

const CHECK_DATE = "2026-11-04";

const settings = { customMap: {}, customInstances: {} };

// Messages that have to outlive the re-render caused by saving, by service
const savedStamps = new Set();

// The Instances filter, kept across re-renders
let instanceQuery = "";

let pendingWrite = Promise.resolve();

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(["customMap", "customInstances"]);
  settings.customMap = stored.customMap ?? {};
  settings.customInstances = stored.customInstances ?? {};
}

// True while someone has an unsaved address in a field, which a re-render would wipe
export function isEditingInstance() {
  const input = document.activeElement;
  if (savedStamps.size || !input?.id?.startsWith("custom-")) return false;
  const stored = settings.customInstances[input.id.slice("custom-".length)] ?? "";
  return input.value.trim() !== stored;
}

// Queued so two quick changes can't overwrite each other
function updateStored(key, change) {
  pendingWrite = pendingWrite
    .then(async () => {
      const { [key]: value = {} } = await chrome.storage.sync.get(key);
      change(value);
      await chrome.storage.sync.set({ [key]: value });
    })
    .catch((error) => console.error("Error saving settings:", error));
  return pendingWrite;
}

function saveSiteEnabled(site, enabled) {
  return updateStored("customMap", (customMap) => {
    site.hosts.forEach((host) => {
      if (enabled) {
        delete customMap[host];
      } else {
        customMap[host] = "";  // Empty string means disabled
      }
    });
  });
}

function saveDefaultInstance(service, url) {
  return updateStored("customInstances", (customInstances) => {
    if (url) {
      customInstances[service] = url;
    } else {
      delete customInstances[service];
    }
  });
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === "onclick" || name === "onchange" || name === "oninput" || name === "onsubmit") {
      node[name] = value;
    } else if (value === true) {
      node.setAttribute(name, "");
    } else if (value !== false && value != null) {
      node.setAttribute(name, value);
    }
  }
  node.append(...children.filter((child) => child != null));
  return node;
}

function externalLink(url, label, className = "link") {
  return el("a", { href: url, target: "_blank", rel: "noreferrer", class: className }, label);
}

function pill(label, kind = "neutral") {
  return el("span", { class: `pill pill-${kind}` }, label);
}

function hostOf(url) {
  return url.replace(/^https?:\/\//, "");
}

function pageHeader(title, subtitle) {
  return el("header", { class: "view-header" }, el("h1", {}, title), el("p", { class: "view-sub" }, subtitle));
}

function projectFor(service) {
  return PROJECTS.find((project) => project.service === service);
}

// Sites view: which sites get redirected, and where to

function routeFor(site, routeId) {
  const from = site.hosts.find((host) => !host.startsWith("www.")) ?? site.hosts[0];
  const custom = settings.customInstances[site.service];
  const count = INSTANCES[site.service].length;
  const name = projectFor(site.service).name;

  let target;
  if (!hasInstances(site, settings.customInstances) || !isSiteEnabled(site, settings.customMap)) {
    target = el("span", { class: "route-to route-none" }, "opens normally");
  } else if (custom) {
    target = el("span", { class: "route-to" }, hostOf(custom));
  } else {
    target = el("span", { class: "route-to" }, `${count} ${name} ${count === 1 ? "host" : "hosts"}`);
  }

  return el("p", { class: "route", id: routeId },
    el("span", {}, from),
    el("span", { class: "route-target" },
      el("span", { class: "route-arrow", "aria-hidden": "true" }, "→"),
      target));
}

function renderSites(container, navigate) {
  const redirecting = SITES.filter((site) =>
    hasInstances(site, settings.customInstances) && isSiteEnabled(site, settings.customMap));
  const waiting = SITES.filter((site) => !hasInstances(site, settings.customInstances));

  const subtitle = `${redirecting.length} of ${SITES.length} sites redirect.` +
    (waiting.length ? ` ${waiting.length} have no public instance and open normally until you add your own.` : "");

  const list = el("div", { class: "panel" });

  SITES.forEach((site) => {
    const routeId = `route-${site.service}`;
    const custom = settings.customInstances[site.service];

    // A site with nowhere to go gets the way to fix that, rather than a switch that can't be used
    if (!hasInstances(site, settings.customInstances)) {
      list.append(el("div", { class: "row site-row" },
        el("div", { class: "row-main" },
          el("div", { class: "row-title" }, el("span", { class: "site-name" }, site.name)),
          routeFor(site, routeId)),
        el("button", {
          type: "button",
          class: "button",
          "aria-label": `Add your own ${site.name} instance`,
          onclick: () => navigate("self-host", site.service)
        }, "Add yours")));
      return;
    }

    const inputId = `site-${site.service}`;
    const toggle = el("input", {
      type: "checkbox",
      role: "switch",
      id: inputId,
      class: "switch",
      "aria-describedby": routeId,
      onchange: () => saveSiteEnabled(site, toggle.checked)
    });
    toggle.checked = isSiteEnabled(site, settings.customMap);

    list.append(el("div", { class: "row site-row" },
      el("div", { class: "row-main" },
        el("div", { class: "row-title" },
          el("label", { for: inputId, class: "site-name" }, site.name),
          custom ? pill("Your instance", "positive") : null),
        routeFor(site, routeId)),
      toggle));
  });

  container.append(pageHeader("Sites", subtitle), list);
}

// Instances view: every host we know of and where it came from

// A host of any frontend for a site can be that site's default, so a Piped host can serve YouTube.
// Returns null for a project nothing can open, which gets no button.
function defaultKeyFor(project) {
  const site = SITES.find((candidate) => candidate.name === project.replaces);
  if (site) return site.service;
  return Object.values(CATEGORIZED_QUICK_LINKS).flat().includes(project.service) ? project.service : null;
}

function instanceStatus(url, kind) {
  if (kind === "custom") return pill("Your instance", "positive");
  if (kind === "archive") return pill("Archive");
  return INSTANCE_NOTES[url] ? pill(INSTANCE_NOTES[url], "warning") : pill("Checked", "positive");
}

function instanceRow(project, url, kind) {
  const key = defaultKeyFor(project);
  const isDefault = key && settings.customInstances[key] === url;

  let action = null;
  if (isDefault) {
    action = el("button", { type: "button", class: "text-button", onclick: () => saveDefaultInstance(key, null) }, "Stop using");
  } else if (key) {
    action = el("button", { type: "button", class: "text-button", onclick: () => saveDefaultInstance(key, url) }, "Use as default");
  }

  return el("li", { class: "row host-row", "data-search": `${project.service} ${url}` },
    externalLink(url, hostOf(url), "host"),
    instanceStatus(url, kind),
    action);
}

function renderInstances(container) {
  const sources = el("ul", { class: "panel source-list" }, ...SOURCES.map((source) =>
    el("li", { class: "row" },
      el("div", { class: "row-main" },
        externalLink(source.url, source.name),
        el("p", { class: "row-sub" }, source.detail)))));

  const totalHosts = new Set([
    ...Object.values(INSTANCES).flat(),
    ...Object.values(FARSIDE_ARCHIVE).flat()
  ]).size;

  const filter = el("input", { type: "search", id: "instance-filter", class: "input", autocomplete: "off" });
  const count = el("p", { class: "row-sub", role: "status" });
  const empty = el("p", { class: "empty", hidden: true }, "No instance matches that search.");

  const groups = PROJECTS.map((project) => {
    const checked = INSTANCES[project.service] ?? [];
    const archived = (FARSIDE_ARCHIVE[project.service] ?? []).filter((url) => !checked.includes(url));
    const custom = settings.customInstances[project.service];
    const typedIn = custom && !checked.includes(custom) && !archived.includes(custom);

    const rows = [
      ...(typedIn ? [instanceRow(project, custom, "custom")] : []),
      ...checked.map((url) => instanceRow(project, url, "checked"))
    ];

    const details = archived.length
      ? el("details", { class: "archive" },
        el("summary", {}, `${archived.length} more from the ${FARSIDE_ARCHIVE_DATE} archive`),
        el("ul", { class: "host-list" }, ...archived.map((url) => instanceRow(project, url, "archive"))))
      : null;

    return el("section", { class: "service", "data-name": `${project.name} ${project.replaces}`.toLowerCase() },
      el("div", { class: "service-head" },
        el("h3", {}, project.name),
        el("span", { class: "row-sub" }, project.replaces)),
      !rows.length && !details ? el("p", { class: "empty" }, "No host listed. You can run your own from the Self-host tab.") : null,
      el("ul", { class: "host-list" }, ...rows),
      details);
  });

  const list = el("div", { class: "panel" }, ...groups);

  function applyFilter() {
    instanceQuery = filter.value;
    const query = instanceQuery.trim().toLowerCase();
    let shown = 0;
    groups.forEach((group) => {
      const nameMatches = group.dataset.name.includes(query);
      let matches = 0;
      group.querySelectorAll(".host-row").forEach((row) => {
        const visible = !query || nameMatches || row.dataset.search.toLowerCase().includes(query);
        row.hidden = !visible;
        if (visible) matches++;
      });
      const archive = group.querySelector("details");
      if (archive) {
        // A chosen default stays in view, so "Stop using" isn't hidden after the screen redraws
        const holdsDefault = [...archive.querySelectorAll(".host")].some((link) =>
          Object.values(settings.customInstances).includes(link.getAttribute("href")));
        archive.open = holdsDefault || (Boolean(query) && matches > 0);
      }
      group.hidden = Boolean(query) && !nameMatches && matches === 0;
      shown += matches;
    });
    count.textContent = query ? `${shown} of ${totalHosts} hosts` : `${totalHosts} hosts across ${PROJECTS.length} projects`;
    empty.hidden = !query || groups.some((group) => !group.hidden);
  }
  filter.value = instanceQuery;
  filter.oninput = applyFilter;
  applyFilter();

  container.append(
    pageHeader("Instances", `Static lists, not live status. Checked means the page loaded on ${CHECK_DATE}; Archive hosts are unchecked.`),
    el("h2", {}, "Sources"),
    sources,
    el("h2", {}, "All instances"),
    el("div", { class: "field" },
      el("label", { for: "instance-filter" }, "Filter by project or host"),
      filter,
      count),
    empty,
    list);
}

// Self-host view: the open-source projects behind each frontend

function instanceForm(site) {
  const inputId = `custom-${site.service}`;
  const errorId = `${inputId}-error`;
  const custom = settings.customInstances[site.service];

  const input = el("input", {
    type: "text",
    id: inputId,
    class: "input",
    placeholder: "https://",
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": errorId
  });
  input.value = custom ?? "";

  const message = el("p", { class: "field-message", id: errorId });
  if (savedStamps.delete(site.service)) message.textContent = "Saved";

  const form = el("form", {
    class: "field",
    novalidate: true,
    onsubmit: async (event) => {
      event.preventDefault();
      const result = parseInstanceUrl(input.value);
      if (result.error) {
        message.textContent = result.error;
        message.classList.add("field-error");
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      savedStamps.add(site.service);
      await saveDefaultInstance(site.service, result.url);
    }
  },
  el("label", { for: inputId }, `Your ${site.name} instance`),
  el("div", { class: "field-row" },
    input,
    el("button", { type: "submit", class: "button button-primary" }, "Save"),
    custom
      ? el("button", {
        type: "button",
        class: "button",
        onclick: () => saveDefaultInstance(site.service, null)
      }, "Remove")
      : null),
  message);

  form.dataset.service = site.service;
  return form;
}

function renderSelfHost(container, focusService) {
  const groups = [...new Set(PROJECTS.map((project) => project.replaces))];

  const sections = groups.map((group) => {
    const site = SITES.find((candidate) => candidate.name === group);
    const projects = PROJECTS.filter((project) => project.replaces === group);

    return el("section", { class: "settings-row" },
      el("div", { class: "settings-label" },
        el("h2", {}, group),
        site
          ? el("p", { class: "row-sub" }, settings.customInstances[site.service]
            ? `Redirecting to ${hostOf(settings.customInstances[site.service])}`
            : INSTANCES[site.service].length
              ? "Using public instances"
              : "No public instance. Opens normally.")
          : null),
      el("div", { class: "panel" },
        el("ul", { class: "project-list" }, ...projects.map((project) =>
          el("li", { class: "row project-row" },
            el("div", { class: "row-main" },
              externalLink(project.repo, project.name),
              project.note ? el("p", { class: "row-sub" }, project.note) : null),
            el("span", { class: "license" }, project.license ?? "—"),
            project.docs ? externalLink(project.docs, "Install guide", "link link-quiet") : null))),
        site ? instanceForm(site) : null));
  });

  container.append(
    pageHeader("Self-host", "Every frontend here is open source. Run your own and redirects go to it instead of public instances. If it's down you'll see Chrome's error page, never a public fallback."),
    ...sections);

  if (focusService) container.querySelector(`#custom-${CSS.escape(focusService)}`)?.focus();
}

// Quick access view: open a frontend directly

function renderQuickLinks(container) {
  const rows = Object.entries(CATEGORIZED_QUICK_LINKS).map(([category, services]) =>
    el("div", { class: "row quick-row" },
      el("span", { class: "quick-name" }, category),
      el("div", { class: "quick-buttons" }, ...services.map((service) =>
        el("button", {
          type: "button",
          class: "button quicklink-button",
          title: `Open a ${projectFor(service).name} instance`,
          onclick: () => window.open(settings.customInstances[service] ?? pickInstance(service), "_blank")
        }, projectFor(service).name)))));

  container.append(
    pageHeader("Quick access", "Open a frontend directly. Each click picks a host from the list, or your own if you set one."),
    el("div", { class: "panel" }, ...rows));
}

export const VIEWS = {
  "sites": (container, navigate) => renderSites(container, navigate),
  "instances": (container) => renderInstances(container),
  "self-host": (container, navigate, focusService) => renderSelfHost(container, focusService),
  "quick": (container) => renderQuickLinks(container)
};
