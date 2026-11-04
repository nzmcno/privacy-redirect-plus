// redirects.js
// Site definitions and redirect logic shared by the service worker, popup and options page

import { PROJECTS } from "./catalog.js";

// farside.link shut down in August 2026 and its repository is archived, so its list no longer changes.
// These hosts come from its final services.json (benbusby/farside@af08778f3c), minus the ones that were
// unreachable or broken when checked on 2026-11-04. Two exceptions: dumb had no working host there, so its
// hosts come from LibRedirect (libredirect/instances, data.json), and most searxng hosts come from Farside's
// July archive (archive.js). A site whose service has no hosts is only redirected to the user's own instance.
export const INSTANCES = {
  invidious: ["https://yt.chocolatemoo53.com", "https://inv.nadeko.net", "https://invidious.tiekoetter.com"],
  nitter: ["https://nitter.tiekoetter.com"],
  redlib: ["https://red.artemislena.eu", "https://safereddit.com"],
  proxigram: [],
  proxitok: [],
  anonymousoverflow: [],
  wikiless: ["https://wikiless.tiekoetter.com"],
  scribe: ["https://scribe.r4fo.com"],
  quetre: [],
  rimgo: [
    "https://anaimg.starbeamrainbowlabs.com",
    "https://imgur.artemislena.eu",
    "https://r.opnxng.com",
    "https://ri.nadeko.net",
    "https://rimgo.4o1x5.dev",
    "https://rimgo.ducks.party",
    "https://rimgo.hostux.net",
    "https://rmgur.com"
  ],
  libremdb: [],
  simplytranslate: ["https://simplytranslate.org"],
  lingva: ["https://lingva.lunar.icu"],
  breezewiki: [
    "https://breeze.hostux.net",
    "https://breezewiki.moonshadow.dev",
    "https://breezewiki.nadeko.net",
    "https://breezewiki.private.coffee",
    "https://breezewiki.pussthecat.org"
  ],
  dumb: ["https://dumb.artemislena.eu", "https://dumb.bloat.cat"],
  tent: [
    "https://bandcamp.lurkmore.com",
    "https://tent.deep-swarm.xyz",
    "https://tent.private.coffee",
    "https://tent.sny.sh",
    "https://tn.maid.zone"
  ],
  gothub: ["https://gothub.projectsegfau.lt"],
  librarian: [],
  whoogle: ["https://search.sethforprivacy.com"],
  searxng: [
    "https://searx.be",
    "https://baresearch.org",
    "https://paulgo.io",
    "https://priv.au",
    "https://search.inetol.net",
    "https://searx.tiekoetter.com"
  ],
  "4get": ["https://4get.ca", "https://4get.dcs0.hu", "https://4get.hbubli.cc", "https://4get.lunar.icu"],
  librey: ["https://librey.darkness.services"]
};

// Sites in display order. Toggling a site writes every host in its list to customMap.
export const SITES = [
  { name: "YouTube", service: "invidious", hosts: ["www.youtube.com", "youtube.com", "m.youtube.com"] },
  {
    name: "Twitter/X",
    service: "nitter",
    hosts: ["twitter.com", "www.twitter.com", "mobile.twitter.com", "x.com", "www.x.com", "mobile.x.com"]
  },
  {
    name: "Reddit",
    service: "redlib",
    hosts: ["www.reddit.com", "reddit.com", "old.reddit.com", "new.reddit.com", "m.reddit.com"]
  },
  { name: "Instagram", service: "proxigram", hosts: ["instagram.com", "www.instagram.com"] },
  {
    name: "TikTok",
    service: "proxitok",
    hosts: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]
  },
  { name: "Stack Overflow", service: "anonymousoverflow", hosts: ["stackoverflow.com", "www.stackoverflow.com"] },
  { name: "Wikipedia", service: "wikiless", hosts: ["en.wikipedia.org", "en.m.wikipedia.org"] },
  { name: "Medium", service: "scribe", hosts: ["medium.com", "www.medium.com"] },
  { name: "Quora", service: "quetre", hosts: ["quora.com", "www.quora.com"] },
  { name: "Imgur", service: "rimgo", hosts: ["imgur.com", "www.imgur.com", "m.imgur.com"] },
  { name: "IMDB", service: "libremdb", hosts: ["www.imdb.com", "imdb.com", "m.imdb.com"] },
  { name: "Google Translate", service: "simplytranslate", hosts: ["translate.google.com"] },
  { name: "Fandom", service: "breezewiki", hosts: ["fandom.com", "www.fandom.com"] },
  { name: "Genius", service: "dumb", hosts: ["genius.com", "www.genius.com"] },
  { name: "Bandcamp", service: "tent", hosts: ["bandcamp.com", "www.bandcamp.com"] },
  { name: "GitHub", service: "gothub", hosts: ["github.com", "www.github.com"] },
  { name: "Odysee", service: "librarian", hosts: ["odysee.com", "www.odysee.com"] }
];

const FANDOM_WIKI_HOST = /^([^.]+)\.fandom\.com$/;
const FANDOM_WIKI_PATH = /^\/([a-z-]+\/)?wiki\//;

// Limits the listeners to relevant hosts, so the worker never sees the rest of the user's browsing.
// "hostEquals" rather than "hostSuffix", which would make x.com match netflix.com.
// Includes sites with no public host, since adding an instance shouldn't need a filter change.
export const NAVIGATION_FILTER = {
  url: [
    ...SITES.flatMap((site) => site.hosts.map((hostEquals) => ({ hostEquals }))),
    { hostSuffix: ".fandom.com" }
  ]
};

// Every host a redirect can land on, for spotting one that fails
export function failoverFilter(addedInstances = {}) {
  const instances = [...Object.values(INSTANCES).flat(), ...Object.values(addedInstances).flat()];
  return { url: instances.map((instance) => ({ hostEquals: new URL(instance).hostname })) };
}

// The instances the user added for a service. For a site's main service this includes every
// frontend of that site, so a Piped instance serves YouTube alongside an Invidious one.
export function addedFor(service, addedInstances = {}) {
  const site = SITES.find((candidate) => candidate.service === service);
  const services = site
    ? PROJECTS.filter((project) => project.replaces === site.name).map((project) => project.service)
    : [service];
  return services.flatMap((name) => addedInstances[name] ?? []);
}

// Once a service has instances of the user's, those replace the public list rather than join it
export function instancePool(service, addedInstances = {}) {
  const added = addedFor(service, addedInstances);
  return added.length ? added : INSTANCES[service] ?? [];
}

// prefs holds customInstances, one chosen default per service, and addedInstances, a list per service
export function hasInstances(site, prefs = {}) {
  return Boolean(prefs.customInstances?.[site.service]) || instancePool(site.service, prefs.addedInstances).length > 0;
}

// Only an empty string disables a site. Older versions also stored farside.link URLs here when a
// site was re-enabled, and those must not be treated as redirect targets.
export function isSiteEnabled(site, customMap) {
  return !site.hosts.some((host) => customMap[host] === "");
}

// Picks a random host for the service, skipping any that have already failed
export function pickInstance(service, exclude = [], addedInstances = {}) {
  const candidates = instancePool(service, addedInstances).filter((instance) => !exclude.includes(instance));
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

// Wikis live on subdomains (minecraft.fandom.com/wiki/Creeper), which BreezeWiki serves as /minecraft/wiki/Creeper
function findTarget(url) {
  const site = SITES.find((candidate) => candidate.hosts.includes(url.hostname));
  if (site) return { site, pathname: url.pathname };

  const wiki = url.hostname.match(FANDOM_WIKI_HOST);
  if (wiki && FANDOM_WIKI_PATH.test(url.pathname)) {
    return { site: SITES.find((candidate) => candidate.name === "Fandom"), pathname: `/${wiki[1]}${url.pathname}` };
  }
  return null;
}

// Returns where a navigation should go, or null if it should be left alone.
// "pinned" means the user chose this one instance, so a failure must not move on to another.
export function getRedirect(rawUrl, customMap, prefs = {}) {
  const url = new URL(rawUrl);
  const target = findTarget(url);
  if (!target || !isSiteEnabled(target.site, customMap)) return null;

  const pinned = prefs.customInstances?.[target.site.service];
  const instance = pinned ?? pickInstance(target.site.service, [], prefs.addedInstances);
  if (!instance) return null;

  return {
    service: target.site.service,
    instance,
    pinned: Boolean(pinned),
    url: instance + target.pathname + url.search + url.hash
  };
}

// Checks an address typed by the user. Returns { url } or { error }, with the error ready to show.
export function parseInstanceUrl(input) {
  const text = input.trim();
  if (!text) return { error: "Enter the address of your instance." };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "That isn't a valid address. Try https://invidious.example.com." };
  }

  if (!["http:", "https:"].includes(url.protocol)) return { error: "Use an http or https address." };
  if (url.username || url.password) return { error: "Leave out the username and password." };
  if (findTarget(new URL(`${url.origin}/wiki/`))) {
    return { error: `${url.hostname} is a site this extension redirects, so it would loop.` };
  }

  // Keeps the path for instances served from a subfolder behind a reverse proxy
  return { url: url.origin + url.pathname.replace(/\/+$/, "") };
}
