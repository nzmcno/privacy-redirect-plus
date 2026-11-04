// redirects.js
// Site definitions and redirect logic shared by the service worker, popup and options page

// farside.link shut down in August 2026 and its repository is archived, so its list no longer changes.
// These hosts come from its final services.json (benbusby/farside@af08778f3c), minus the ones that were
// unreachable or broken when checked on 2026-11-04. A site whose service has no hosts is not redirected.
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
  dumb: [],
  tent: [
    "https://bandcamp.lurkmore.com",
    "https://tent.deep-swarm.xyz",
    "https://tent.private.coffee",
    "https://tent.sny.sh",
    "https://tn.maid.zone"
  ],
  gothub: ["https://gothub.projectsegfau.lt"],
  whoogle: ["https://search.sethforprivacy.com"],
  searxng: ["https://searx.be"],
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
  { name: "GitHub", service: "gothub", hosts: ["github.com", "www.github.com"] }
];

// Services organized by category for the Quick Access tabs
export const CATEGORIZED_QUICK_LINKS = {
  "Search": ["whoogle", "searxng", "4get", "librey"],
  "Google Translate": ["simplytranslate", "lingva"],
  "YouTube": ["invidious"],
  "Twitter": ["nitter"],
  "Reddit": ["redlib"],
  "Wikipedia": ["wikiless"],
  "GitHub": ["gothub"],
  "Medium": ["scribe"],
  "Imgur": ["rimgo"],
  "Fandom": ["breezewiki"],
  "Bandcamp": ["tent"]
};

const FANDOM_WIKI_HOST = /^([^.]+)\.fandom\.com$/;
const FANDOM_WIKI_PATH = /^\/([a-z-]+\/)?wiki\//;

// Limits the listeners to relevant hosts, so the worker never sees the rest of the user's browsing.
// "hostEquals" rather than "hostSuffix", which would make x.com match netflix.com.
export const NAVIGATION_FILTER = {
  url: [
    ...SITES.filter(hasInstances).flatMap((site) => site.hosts.map((hostEquals) => ({ hostEquals }))),
    { hostSuffix: ".fandom.com" }
  ]
};

export const INSTANCE_FILTER = {
  url: Object.values(INSTANCES).flat().map((instance) => ({ hostEquals: new URL(instance).hostname }))
};

export function hasInstances(site) {
  return INSTANCES[site.service].length > 0;
}

// Only an empty string disables a site. Older versions also stored farside.link URLs here when a
// site was re-enabled, and those must not be treated as redirect targets.
export function isSiteEnabled(site, customMap) {
  return !site.hosts.some((host) => customMap[host] === "");
}

// Picks a random host for the service, skipping any that have already failed
export function pickInstance(service, exclude = []) {
  const candidates = INSTANCES[service].filter((instance) => !exclude.includes(instance));
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

// Returns where a navigation should go, or null if it should be left alone
export function getRedirect(rawUrl, customMap) {
  const url = new URL(rawUrl);
  const target = findTarget(url);
  if (!target || !isSiteEnabled(target.site, customMap)) return null;

  const instance = pickInstance(target.site.service);
  if (!instance) return null;

  return {
    service: target.site.service,
    instance,
    url: instance + target.pathname + url.search + url.hash
  };
}
