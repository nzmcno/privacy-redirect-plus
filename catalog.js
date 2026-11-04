// catalog.js
// Open-source projects and data sources shown in the Self-host and Instances tabs

// Every link was opened on 2026-11-04. Licenses come from each forge's API; null means it didn't report one.
export const PROJECTS = [
  { service: "invidious", name: "Invidious", replaces: "YouTube", repo: "https://github.com/iv-org/invidious", license: "AGPL-3.0", docs: "https://docs.invidious.io/installation/" },
  { service: "piped", name: "Piped", replaces: "YouTube", repo: "https://github.com/TeamPiped/Piped", license: "AGPL-3.0" },
  { service: "nitter", name: "Nitter", replaces: "Twitter/X", repo: "https://github.com/zedeus/nitter", license: "AGPL-3.0", note: "Repository archived. Its maintainer reports takedown demands from X Corp." },
  { service: "redlib", name: "Redlib", replaces: "Reddit", repo: "https://github.com/redlib-org/redlib", license: "AGPL-3.0" },
  { service: "libreddit", name: "Libreddit", replaces: "Reddit", repo: "https://github.com/libreddit/libreddit", license: "AGPL-3.0", note: "Redlib is its maintained fork." },
  { service: "teddit", name: "Teddit", replaces: "Reddit", repo: "https://codeberg.org/teddit/teddit", license: null },
  { service: "proxigram", name: "Proxigram", replaces: "Instagram", repo: "https://codeberg.org/proxigram/proxigram", license: null },
  { service: "proxitok", name: "ProxiTok", replaces: "TikTok", repo: "https://github.com/pablouser1/ProxiTok", license: "AGPL-3.0" },
  { service: "anonymousoverflow", name: "AnonymousOverflow", replaces: "Stack Overflow", repo: "https://github.com/httpjamesm/AnonymousOverflow", license: "MPL-2.0" },
  { service: "wikiless", name: "Wikiless", replaces: "Wikipedia", repo: "https://github.com/tiekoetter/Wikiless", license: "AGPL-3.0" },
  { service: "scribe", name: "Scribe", replaces: "Medium", repo: "https://git.sr.ht/~edwardloveall/scribe", license: null },
  { service: "quetre", name: "Quetre", replaces: "Quora", repo: "https://github.com/zyachel/quetre", license: "AGPL-3.0" },
  { service: "rimgo", name: "rimgo", replaces: "Imgur", repo: "https://codeberg.org/rimgo/rimgo", license: null },
  { service: "libremdb", name: "libremdb", replaces: "IMDB", repo: "https://github.com/zyachel/libremdb", license: "AGPL-3.0" },
  { service: "simplytranslate", name: "SimplyTranslate", replaces: "Google Translate", repo: "https://codeberg.org/ManeraKai/simplytranslate", license: null },
  { service: "lingva", name: "Lingva", replaces: "Google Translate", repo: "https://github.com/thedaviddelta/lingva-translate", license: "AGPL-3.0" },
  { service: "breezewiki", name: "BreezeWiki", replaces: "Fandom", repo: "https://gitdab.com/cadence/breezewiki", license: null },
  { service: "dumb", name: "Dumb", replaces: "Genius", repo: "https://github.com/rramiachraf/dumb", license: "MIT" },
  { service: "tent", name: "Tent", replaces: "Bandcamp", repo: "https://forgejo.sny.sh/sun/Tent", license: null },
  { service: "gothub", name: "GotHub", replaces: "GitHub", repo: "https://codeberg.org/gothub/gothub", license: null },
  { service: "searxng", name: "SearXNG", replaces: "Search", repo: "https://github.com/searxng/searxng", license: "AGPL-3.0", docs: "https://docs.searxng.org/" },
  { service: "searx", name: "searx", replaces: "Search", repo: "https://github.com/searx/searx", license: "AGPL-3.0" },
  { service: "whoogle", name: "Whoogle", replaces: "Search", repo: "https://github.com/benbusby/whoogle-search", license: "MIT", note: "Repository archived." },
  { service: "4get", name: "4get", replaces: "Search", repo: "https://git.lolcat.ca/lolcat/4get", license: "AGPL-3.0" },
  { service: "librey", name: "LibreY", replaces: "Search", repo: "https://github.com/Ahwxorg/LibreY", license: "AGPL-3.0" },
  { service: "librarian", name: "Librarian", replaces: "Odysee", repo: "https://codeberg.org/librarian/librarian", license: null, note: "Repository archived." }
];

export const SOURCES = [
  { name: "Farside", detail: "Shut down in August 2026, repository archived", url: "https://github.com/benbusby/farside" },
  { name: "Farside's final services.json", detail: "Last updated 2026-08-19, commit af08778f3c", url: "https://github.com/benbusby/farside/blob/af08778f3c/services.json" },
  { name: "Farside on the Internet Archive", detail: "Saved 2026-07-19, the Archive list on this page", url: "https://web.archive.org/web/20260719005419/https://farside.link/" },
  { name: "LibRedirect instances", detail: "Maintained list, source of the Dumb hosts", url: "https://github.com/libredirect/instances" }
];

// Hosts that were reachable on 2026-11-04 but didn't show their content to a plain request
export const INSTANCE_NOTES = {
  "https://yt.chocolatemoo53.com": "Visitor check",
  "https://inv.nadeko.net": "Visitor check",
  "https://invidious.tiekoetter.com": "Returned an error",
  "https://scribe.r4fo.com": "Visitor check"
};
