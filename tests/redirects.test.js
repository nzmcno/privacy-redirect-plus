import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { FARSIDE_ARCHIVE } from "../archive.js";
import { INSTANCE_NOTES, PROJECTS, SOURCES } from "../catalog.js";
import {
  CATEGORIZED_QUICK_LINKS,
  INSTANCES,
  NAVIGATION_FILTER,
  SITES,
  getRedirect,
  hasInstances,
  isSiteEnabled,
  parseInstanceUrl,
  pickInstance
} from "../redirects.js";

const siteNamed = (name) => SITES.find((site) => site.name === name);

function assertRedirectsTo(rawUrl, service, suffix, customMap = {}) {
  const redirect = getRedirect(rawUrl, customMap);
  assert.ok(redirect, `${rawUrl} should redirect`);
  assert.equal(redirect.service, service);
  assert.ok(INSTANCES[service].includes(redirect.instance));
  assert.equal(redirect.url, redirect.instance + suffix);
}

test("keeps path, query and fragment", () => {
  assertRedirectsTo("https://www.reddit.com/r/privacy/?sort=new#top", "redlib", "/r/privacy/?sort=new#top");
  assertRedirectsTo("https://en.wikipedia.org/wiki/Privacy#History", "wikiless", "/wiki/Privacy#History");
});

test("covers www and mobile hosts", () => {
  assertRedirectsTo("https://youtube.com/watch?v=a", "invidious", "/watch?v=a");
  assertRedirectsTo("https://m.youtube.com/watch?v=a", "invidious", "/watch?v=a");
  assertRedirectsTo("https://www.x.com/jack", "nitter", "/jack");
  assertRedirectsTo("https://old.reddit.com/r/privacy", "redlib", "/r/privacy");
  assertRedirectsTo("https://genius.com/Artist-song-lyrics", "dumb", "/Artist-song-lyrics");
});

test("maps Fandom wiki subdomains to BreezeWiki paths", () => {
  assertRedirectsTo("https://minecraft.fandom.com/wiki/Creeper", "breezewiki", "/minecraft/wiki/Creeper");
  assertRedirectsTo("https://minecraft.fandom.com/de/wiki/Creeper", "breezewiki", "/minecraft/de/wiki/Creeper");
});

test("leaves non-wiki Fandom subdomains alone", () => {
  assert.equal(getRedirect("https://auth.fandom.com/signin", {}), null);
});

test("does not match lookalike hosts", () => {
  assert.equal(getRedirect("https://netflix.com/", {}), null);
  assert.equal(getRedirect("https://notreddit.com/r/privacy", {}), null);
  assert.equal(getRedirect("https://mytiktokfans.example/", {}), null);
  assert.equal(getRedirect("https://tiktok.wpme.pl/@user", {}), null);
});

test("does not redirect from an instance back onto an instance", () => {
  for (const instance of Object.values(INSTANCES).flat()) {
    assert.equal(getRedirect(`${instance}/some/path`, {}), null, instance);
  }
});

test("a disabled site is never redirected, whichever host is used", () => {
  const customMap = Object.fromEntries(siteNamed("Reddit").hosts.map((host) => [host, ""]));
  for (const host of siteNamed("Reddit").hosts) {
    assert.equal(getRedirect(`https://${host}/r/privacy`, customMap), null, host);
  }
  assertRedirectsTo("https://imgur.com/a", "rimgo", "/a", customMap);
});

test("settings saved by older versions keep working", () => {
  // Disabled before new hosts were added to the site
  assert.equal(getRedirect("https://old.reddit.com/r/privacy", { "www.reddit.com": "" }), null);
  // A site re-enabled by an older version stored its farside.link URL
  assertRedirectsTo("https://www.reddit.com/r/privacy", "redlib", "/r/privacy", {
    "www.reddit.com": "https://farside.link/libreddit"
  });
});

test("sites with no instances pass through", () => {
  for (const site of SITES.filter((candidate) => !hasInstances(candidate))) {
    for (const host of site.hosts) {
      assert.equal(getRedirect(`https://${host}/`, {}), null, host);
    }
  }
});

test("pickInstance skips failed instances and runs out", () => {
  const [first, second, third] = INSTANCES.invidious;
  assert.equal(pickInstance("invidious", [first, second]), third);
  assert.equal(pickInstance("invidious", [first, second, third]), null);
  assert.equal(pickInstance("proxitok"), null);
});

test("isSiteEnabled treats only an empty string as disabled", () => {
  assert.equal(isSiteEnabled(siteNamed("GitHub"), {}), true);
  assert.equal(isSiteEnabled(siteNamed("GitHub"), { "github.com": "https://farside.link/gothub" }), true);
  assert.equal(isSiteEnabled(siteNamed("GitHub"), { "www.github.com": "" }), false);
});

test("data is consistent", () => {
  for (const site of SITES) {
    assert.ok(site.service in INSTANCES, `${site.name} service`);
  }
  const hosts = SITES.flatMap((site) => site.hosts);
  assert.equal(new Set(hosts).size, hosts.length, "a host belongs to one site");
  for (const service of Object.values(CATEGORIZED_QUICK_LINKS).flat()) {
    assert.ok(INSTANCES[service]?.length > 0, `quick link ${service} has an instance`);
  }
  for (const instance of Object.values(INSTANCES).flat()) {
    assert.ok(instance.startsWith("https://") && !instance.endsWith("/"), instance);
    assert.ok(!instance.includes("farside.link"), instance);
  }
});

test("listener filter covers every site, including those waiting for an instance", () => {
  const filtered = NAVIGATION_FILTER.url.map((rule) => rule.hostEquals).filter(Boolean);
  assert.deepEqual(filtered, SITES.flatMap((site) => site.hosts));
});

test("a chosen instance becomes the default, without fallback", () => {
  const custom = { invidious: "https://tube.home.example" };
  const redirect = getRedirect("https://www.youtube.com/watch?v=a#t", {}, custom);
  assert.equal(redirect.url, "https://tube.home.example/watch?v=a#t");
  assert.equal(redirect.pinned, true);
  assert.equal(getRedirect("https://www.youtube.com/", {}).pinned, false);
});

test("adding an instance turns on a site with no public host", () => {
  const site = siteNamed("TikTok");
  assert.equal(hasInstances(site), false);
  assert.equal(getRedirect("https://www.tiktok.com/@a", {}), null);

  const custom = { proxitok: "http://192.168.1.20:8080/tok" };
  assert.equal(hasInstances(site, custom), true);
  assert.equal(getRedirect("https://www.tiktok.com/@a", {}, custom).url, "http://192.168.1.20:8080/tok/@a");
});

test("turning a site off beats its chosen instance", () => {
  const customMap = Object.fromEntries(siteNamed("YouTube").hosts.map((host) => [host, ""]));
  assert.equal(getRedirect("https://youtube.com/", customMap, { invidious: "https://tube.home.example" }), null);
});

test("parseInstanceUrl accepts what people type and explains what it refuses", () => {
  assert.deepEqual(parseInstanceUrl("tube.home.example"), { url: "https://tube.home.example" });
  assert.deepEqual(parseInstanceUrl("  https://tube.home.example/  "), { url: "https://tube.home.example" });
  assert.deepEqual(parseInstanceUrl("http://192.168.1.20:8080"), { url: "http://192.168.1.20:8080" });
  assert.deepEqual(parseInstanceUrl("localhost:3000"), { url: "https://localhost:3000" });
  assert.deepEqual(parseInstanceUrl("https://home.example/tok/"), { url: "https://home.example/tok" });

  for (const bad of ["", "   ", "javascript://alert(1)", "ftp://a.example", "https://user:pw@a.example", "https://a b"]) {
    assert.ok(parseInstanceUrl(bad).error, JSON.stringify(bad));
  }
  for (const looping of ["https://www.youtube.com", "x.com", "https://minecraft.fandom.com"]) {
    assert.match(parseInstanceUrl(looping).error, /loop/, looping);
  }
});

test("archive.js matches the saved snapshot exactly", () => {
  const md = readFileSync(new URL("../data/farside-snapshot-2026-07-19.md", import.meta.url), "utf8");
  const parsed = {};
  let current = null;
  for (const line of md.split("\n")) {
    const service = line.match(/^\* \[([^\]]+)\]/);
    if (service) {
      current = service[1];
      parsed[current] = [];
    }
    const host = line.match(/^\s+\* (https:\/\/\S+)/);
    if (host) parsed[current].push(host[1]);
  }
  assert.deepEqual(FARSIDE_ARCHIVE, parsed);
});

test("catalog covers everything the UI looks up", () => {
  const services = PROJECTS.map((project) => project.service);
  assert.equal(new Set(services).size, services.length, "one entry per project");

  for (const site of SITES) {
    assert.ok(services.includes(site.service), `${site.name} has a project`);
    assert.ok(PROJECTS.some((project) => project.replaces === site.name), `${site.name} has a group`);
  }
  for (const service of Object.keys(FARSIDE_ARCHIVE)) {
    assert.ok(services.includes(service), `archive service ${service} is listed`);
  }
  for (const service of Object.values(CATEGORIZED_QUICK_LINKS).flat()) {
    assert.ok(services.includes(service), `quick link ${service} is listed`);
  }
  for (const url of [...PROJECTS.map((project) => project.repo), ...SOURCES.map((source) => source.url)]) {
    assert.ok(url.startsWith("https://"), url);
  }
  const hosts = Object.values(INSTANCES).flat();
  for (const url of Object.keys(INSTANCE_NOTES)) {
    assert.ok(hosts.includes(url), `note for ${url} matches a host`);
  }
});
