// ui.js
// Views shared by the popup and the options page

import { INSTANCE_NOTES, PROJECTS, SOURCES } from "./catalog.js";
import { KNOWN_INSTANCES } from "./directory.js";
import {
  INSTANCES,
  SITES,
  addedFor,
  defaultInstance,
  hasInstances,
  isSiteEnabled,
  loadInstallSeed,
  overlayNetwork,
  parseInstanceUrl
} from "./redirects.js";

// A check that hasn't reported for this long stopped with the service worker
const CHECK_STALE_MS = 30000;

const settings = { customMap: {}, customInstances: {}, addedInstances: {}, seed: 0, check: {} };

// Forms that just saved, so their confirmation outlives the re-render saving causes
const savedStamps = new Set();

// Add-instance forms opened in the Instances tab, kept across re-renders
const openForms = new Set();

// Host lists opened in the Instances tab, kept across re-renders
const openLists = new Set();

// The Instances filter, kept across re-renders
let instanceQuery = "";

let pendingWrite = Promise.resolve();

export async function loadSettings() {
  const [stored, local, seed] = await Promise.all([
    chrome.storage.sync.get(["customMap", "customInstances", "addedInstances"]),
    chrome.storage.local.get("instanceCheck"),
    loadInstallSeed()
  ]);
  settings.customMap = stored.customMap ?? {};
  settings.customInstances = stored.customInstances ?? {};
  settings.addedInstances = stored.addedInstances ?? {};
  settings.check = local.instanceCheck ?? {};
  settings.seed = seed;
}

export function isCheckRunning() {
  return Boolean(settings.check.running) && Date.now() - settings.check.updatedAt < CHECK_STALE_MS;
}

// True while someone has an unsaved address in a field, which a re-render would wipe
export function isEditingInstance() {
  const input = document.activeElement;
  return !savedStamps.size && Boolean(input?.matches?.(".instance-input")) && input.value.trim() !== "";
}

export function clearStamps() {
  savedStamps.clear();
}

// Queued so two quick changes can't overwrite each other. Resolves to whether the save worked.
function updateStored(key, change) {
  const write = pendingWrite.then(async () => {
    const { [key]: value = {} } = await chrome.storage.sync.get(key);
    change(value);
    await chrome.storage.sync.set({ [key]: value });
    return true;
  }).catch((error) => {
    console.error("Error saving settings:", error);
    return false;
  });
  pendingWrite = write;
  return write;
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

function saveAddedInstance(service, url) {
  return updateStored("addedInstances", (addedInstances) => {
    addedInstances[service] = [...(addedInstances[service] ?? []), url];
  });
}

async function removeAddedInstance(service, url) {
  await updateStored("addedInstances", (addedInstances) => {
    addedInstances[service] = (addedInstances[service] ?? []).filter((instance) => instance !== url);
    if (!addedInstances[service].length) delete addedInstances[service];
  });
  // Don't leave a site pointing at an address the user just removed
  await updateStored("customInstances", (customInstances) => {
    for (const [key, value] of Object.entries(customInstances)) {
      if (value === url) delete customInstances[key];
    }
  });
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith("on")) {
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

function textAction(label, onclick, ariaLabel) {
  return el("button", { type: "button", class: "text-button", "aria-label": ariaLabel, onclick }, label);
}

// The form for adding an instance. "choices" adds a project picker, for groups with several
// projects and no site to attach them to.
function addInstanceForm({ id, label, service, choices }) {
  const errorId = `${id}-message`;

  const input = el("input", {
    type: "text",
    id,
    class: "input instance-input",
    placeholder: "https://",
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": errorId
  });

  const picker = choices
    ? el("select", { class: "input", id: `${id}-project`, "aria-label": "Project" },
      ...choices.map((project) => el("option", { value: project.service }, project.name)))
    : null;

  const message = el("p", { class: "field-message", id: errorId, role: "status" });
  if (savedStamps.has(id)) message.textContent = "Added";

  function showError(text) {
    message.textContent = text;
    message.classList.add("field-error");
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }

  return el("form", {
    class: "field add-form",
    novalidate: true,
    onsubmit: async (event) => {
      event.preventDefault();
      const target = picker ? picker.value : service;
      const result = parseInstanceUrl(input.value);
      if (result.error) return showError(result.error);
      if ((settings.addedInstances[target] ?? []).includes(result.url)) {
        return showError(`You've already added ${hostOf(result.url)}.`);
      }

      savedStamps.add(id);
      if (!await saveAddedInstance(target, result.url)) {
        savedStamps.delete(id);
        showError("Couldn't save that. Chrome's sync storage may be full, so try removing an instance.");
      }
    }
  },
  el("label", { for: id }, label),
  el("div", { class: "field-row" },
    picker,
    input,
    el("button", { type: "submit", class: "button button-primary" }, "Add")),
  message);
}

// Sites view: which sites get redirected, and where to

function routeFor(site, routeId) {
  const from = site.hosts.find((host) => !host.startsWith("www.")) ?? site.hosts[0];
  const backups = settings.customInstances[site.service] ? 0 : addedFor(site.service, settings.addedInstances).length - 1;

  let target;
  if (!hasInstances(site, settings) || !isSiteEnabled(site, settings.customMap)) {
    target = el("span", { class: "route-to route-none" }, "opens normally");
  } else {
    const host = hostOf(defaultInstance(site.service, settings));
    target = el("span", { class: "route-to" }, backups > 0 ? `${host} +${backups}` : host);
  }

  return el("p", { class: "route", id: routeId },
    el("span", {}, from),
    el("span", { class: "route-target" },
      el("span", { class: "route-arrow", "aria-hidden": "true" }, "→"),
      target));
}

function renderSites(container, navigate) {
  const redirecting = SITES.filter((site) => hasInstances(site, settings) && isSiteEnabled(site, settings.customMap));
  const waiting = SITES.filter((site) => !hasInstances(site, settings));

  const subtitle = `${redirecting.length} of ${SITES.length} sites redirect.` +
    (waiting.length ? ` ${waiting.length} have no public instance and open normally until you add your own.` : "");

  const list = el("div", { class: "panel" });

  SITES.forEach((site) => {
    const routeId = `route-${site.service}`;
    const yours = settings.customInstances[site.service] || addedFor(site.service, settings.addedInstances).length;

    // A site with nowhere to go gets the way to fix that, rather than a switch that can't be used
    if (!hasInstances(site, settings)) {
      list.append(el("div", { class: "row site-row" },
        el("div", { class: "row-main" },
          el("div", { class: "row-title" }, el("span", { class: "site-name" }, site.name)),
          routeFor(site, routeId)),
        el("button", {
          type: "button",
          class: "button",
          "aria-label": `Add your own ${site.name} instance`,
          onclick: () => navigate("instances", site.service)
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
          yours ? pill("Your instance", "positive") : null),
        routeFor(site, routeId)),
      toggle));
  });

  container.append(pageHeader("Sites", subtitle), list);
}

// Instances view: the host each project uses now, and every other host we know of

// A host of any frontend for a site can be that site's default, so a Piped host can serve YouTube
function defaultKeyFor(project) {
  return SITES.find((site) => site.name === project.replaces)?.service ?? project.service;
}

function knownHosts(project) {
  const own = settings.addedInstances[project.service] ?? [];
  const known = [...(INSTANCES[project.service] ?? []), ...(KNOWN_INSTANCES[project.service] ?? [])];
  return [...new Set(known)].filter((url) => !own.includes(url));
}

// Several projects can list one host, so the default is shown once: under the first that lists it,
// or under the site's main project if it was typed in
function projectShowingDefault(key, current) {
  const candidates = PROJECTS.filter((project) => defaultKeyFor(project) === key);
  return candidates.find((project) =>
    knownHosts(project).includes(current) || (settings.addedInstances[project.service] ?? []).includes(current)
  ) ?? candidates.find((project) => project.service === key);
}

// Live hosts first, then ones not tested yet, then the rest
function hostRank(url) {
  if (overlayNetwork(url)) return 2;
  const live = settings.check.results?.[url];
  if (live === true) return 0;
  return live === false ? 3 : 1;
}

function instanceStatus(url) {
  const overlay = overlayNetwork(url);
  if (overlay) return pill(overlay);

  const live = settings.check.results?.[url];
  if (live === false) return pill("Offline", "negative");

  return el("span", { class: "pills" },
    INSTANCE_NOTES[url] ? pill(INSTANCE_NOTES[url], "warning") : null,
    live === true ? pill("Live", "positive") : null);
}

function instanceRow(project, url, { isDefault = false, isOwn = false } = {}) {
  const key = defaultKeyFor(project);
  const host = hostOf(url);
  const isPinned = settings.customInstances[key] === url;

  let action = null;
  if (isPinned) {
    action = textAction("Stop using", () => saveDefaultInstance(key, null), `Stop using ${host} as the default`);
  } else if (!isDefault) {
    action = textAction("Use as default", () => saveDefaultInstance(key, url), `Use ${host} as the default`);
  }

  return el("li", { class: "row host-row", "data-search": `${project.service} ${url}` },
    externalLink(url, host, "host"),
    isDefault ? pill("Default") : null,
    isOwn ? pill("Your instance", "positive") : null,
    instanceStatus(url),
    action,
    isOwn ? textAction("Remove", () => removeAddedInstance(project.service, url), `Remove ${host}`) : null);
}

function checkSummary() {
  const { results, finishedAt, done, total } = settings.check;
  if (isCheckRunning()) return `Checked ${done ?? 0} of ${total ?? "all"} servers. You can close this while it runs.`;
  if (!finishedAt) return "Contacts every server from your connection, and only when you press it.";

  const answers = Object.values(results ?? {});
  const live = answers.filter(Boolean).length;
  return `${live} live, ${answers.length - live} offline. Last checked ${new Date(finishedAt).toLocaleString()}.`;
}

// Called while a check runs, instead of redrawing rows that would jump around under the reader
export function updateCheckProgress() {
  const status = document.getElementById("check-status");
  if (status) status.textContent = checkSummary();
}

function checkBar() {
  const running = isCheckRunning();
  return el("div", { class: "check-bar" },
    el("button", {
      type: "button",
      id: "check-instances",
      class: "button button-primary",
      disabled: running,
      onclick: (event) => {
        event.target.disabled = true;
        event.target.textContent = "Checking…";
        chrome.runtime.sendMessage({ type: "checkInstances" }).catch((error) => console.error("Error starting check:", error));
      }
    }, running ? "Checking…" : "Check instances"),
    el("p", { class: "row-sub", id: "check-status", role: "status" }, checkSummary()));
}

function renderInstances(container, focusService) {
  if (focusService) {
    instanceQuery = "";
    openForms.add(focusService);
  }

  const sources = el("ul", { class: "panel source-list" }, ...SOURCES.map((source) =>
    el("li", { class: "row" },
      el("div", { class: "row-main" },
        externalLink(source.url, source.name),
        el("p", { class: "row-sub" }, source.detail)))));

  const totalHosts = new Set([
    ...Object.values(INSTANCES).flat(),
    ...Object.values(KNOWN_INSTANCES).flat(),
    ...Object.values(settings.addedInstances).flat()
  ]).size;

  const filter = el("input", { type: "search", id: "instance-filter", class: "input", autocomplete: "off" });
  const count = el("p", { class: "row-sub", role: "status" });
  const empty = el("p", { class: "empty", hidden: true }, "No instance matches that search.");

  const groups = PROJECTS.map((project) => {
    const key = defaultKeyFor(project);
    const current = defaultInstance(key, settings);
    const own = settings.addedInstances[project.service] ?? [];
    const showsDefault = current && projectShowingDefault(key, current) === project;

    const rows = own.map((url) => instanceRow(project, url, { isOwn: true, isDefault: showsDefault && url === current }));
    if (showsDefault && !own.includes(current)) rows.unshift(instanceRow(project, current, { isDefault: true }));

    const rest = knownHosts(project)
      .filter((url) => !showsDefault || url !== current)
      .sort((a, b) => hostRank(a) - hostRank(b));
    const liveCount = rest.filter((url) => settings.check.results?.[url] === true).length;

    const more = rest.length
      ? el("details", {
        class: "more-hosts",
        ontoggle: (event) => {
          if (instanceQuery.trim()) return;
          if (event.target.open) {
            openLists.add(project.service);
          } else {
            openLists.delete(project.service);
          }
        }
      },
      el("summary", {}, `Show ${rest.length} ${rows.length ? "more" : rest.length === 1 ? "host" : "hosts"}${liveCount ? `, ${liveCount} live` : ""}`),
      el("ul", { class: "host-list" }, ...rest.map((url) => instanceRow(project, url))))
      : null;

    const formOpen = openForms.has(project.service);

    return el("section", { class: "service", "data-service": project.service, "data-name": `${project.name} ${project.replaces}`.toLowerCase() },
      el("div", { class: "service-head" },
        el("h3", {}, project.name),
        el("span", { class: "row-sub" }, project.replaces),
        el("button", {
          type: "button",
          class: "text-button service-add",
          "aria-expanded": String(formOpen),
          "aria-label": `Add a ${project.name} instance`,
          onclick: (event) => {
            if (formOpen) {
              openForms.delete(project.service);
            } else {
              openForms.add(project.service);
            }
            event.target.dispatchEvent(new Event("redraw", { bubbles: true }));
            document.getElementById(`add-${project.service}`)?.focus();
          }
        }, formOpen ? "Cancel" : "Add instance")),
      formOpen
        ? addInstanceForm({ id: `add-${project.service}`, label: `Address of your ${project.name} instance`, service: project.service })
        : null,
      !rows.length && !more && !formOpen ? el("p", { class: "empty" }, "No host listed. Add one if you run or know of an instance.") : null,
      rows.length ? el("ul", { class: "host-list" }, ...rows) : null,
      more);
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
      const more = group.querySelector("details");
      if (more) more.open = query ? matches > 0 : openLists.has(group.dataset.service);
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
    pageHeader("Instances", "Each project shows the host it uses now. Live means a server answered, not that its pages work. Add as many of your own as you like: a site with instances of yours uses only those."),
    checkBar(),
    el("h2", {}, "All instances"),
    el("div", { class: "field" },
      el("label", { for: "instance-filter" }, "Filter by project or host"),
      filter,
      count),
    empty,
    list,
    el("h2", {}, "Sources"),
    sources);

  if (focusService) container.querySelector(`#add-${CSS.escape(focusService)}`)?.focus();
}

// Self-host view: the open-source projects behind each frontend

function selfHostStatus(group, site) {
  if (!site) return "Not redirected. Your instances open from Quick access.";

  const pinned = settings.customInstances[site.service];
  const added = addedFor(site.service, settings.addedInstances);
  if (pinned) return `Redirecting to ${hostOf(pinned)}`;
  if (added.length) return `Using your ${added.length === 1 ? "instance" : `${added.length} instances`}`;
  return INSTANCES[site.service].length ? "Using public instances" : "No public instance. Opens normally.";
}

function renderSelfHost(container) {
  const groups = [...new Set(PROJECTS.map((project) => project.replaces))];

  const sections = groups.map((group) => {
    const site = SITES.find((candidate) => candidate.name === group);
    const projects = PROJECTS.filter((project) => project.replaces === group);

    const added = projects.flatMap((project) =>
      (settings.addedInstances[project.service] ?? []).map((url) => ({ project, url })));

    const formId = `custom-${site?.service ?? group.toLowerCase()}`;

    return el("section", { class: "settings-row" },
      el("div", { class: "settings-label" },
        el("h2", {}, group),
        el("p", { class: "row-sub" }, selfHostStatus(group, site))),
      el("div", { class: "panel" },
        el("ul", { class: "project-list" }, ...projects.map((project) =>
          el("li", { class: "row project-row" },
            el("div", { class: "row-main" },
              externalLink(project.repo, project.name),
              project.note ? el("p", { class: "row-sub" }, project.note) : null),
            el("span", { class: "license" }, project.license ?? "—"),
            project.docs ? externalLink(project.docs, "Install guide", "link link-quiet") : null))),
        added.length
          ? el("ul", { class: "added-list" }, ...added.map(({ project, url }) =>
            el("li", { class: "row host-row" },
              externalLink(url, hostOf(url), "host"),
              projects.length > 1 ? el("span", { class: "row-sub" }, project.name) : null,
              textAction("Remove", () => removeAddedInstance(project.service, url), `Remove ${hostOf(url)}`))))
          : null,
        addInstanceForm({
          id: formId,
          label: `Add a ${group} instance`,
          service: site?.service ?? projects[0].service,
          choices: site ? null : projects
        })));
  });

  container.append(
    pageHeader("Self-host", "Every frontend here is open source. Run your own and add it, as many as you like. A site with instances of yours uses only those, moving to the next if one can't be reached, and never falls back to a public host."),
    ...sections);
}

// Quick access view: open a frontend directly

function quickTarget(service) {
  const own = settings.addedInstances[service] ?? [];
  const pool = own.length ? own : INSTANCES[service] ?? [];
  return settings.customInstances[service] ?? pool[Math.floor(Math.random() * pool.length)];
}

function renderQuickLinks(container) {
  const groups = [...new Set(PROJECTS.map((project) => project.replaces))]
    .sort((a, b) => (b === "Search") - (a === "Search"));

  const rows = groups.map((group) => {
    const projects = PROJECTS.filter((project) => project.replaces === group && quickTarget(project.service));
    if (!projects.length) return null;

    return el("div", { class: "row quick-row" },
      el("span", { class: "quick-name" }, group),
      el("div", { class: "quick-buttons" }, ...projects.map((project) =>
        el("button", {
          type: "button",
          class: "button quicklink-button",
          title: `Open a ${project.name} instance`,
          onclick: () => window.open(quickTarget(project.service), "_blank")
        }, project.name))));
  });

  container.append(
    pageHeader("Quick access", "Open a frontend directly. Each click picks a host from the list, or from your own if you added any."),
    el("div", { class: "panel" }, ...rows.filter(Boolean)));
}

export const VIEWS = {
  "sites": (container, navigate) => renderSites(container, navigate),
  "instances": (container, navigate, focusService) => renderInstances(container, focusService),
  "self-host": (container) => renderSelfHost(container),
  "quick": (container) => renderQuickLinks(container)
};
