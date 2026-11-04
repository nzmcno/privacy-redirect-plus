import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { checkAll, hostsToCheck, isLive } from "../checker.js";
import { INSTANCE_NOTES, PROJECTS, SOURCES } from "../catalog.js";
import { KNOWN_INSTANCES } from "../directory.js";
import {
  INSTANCES,
  NAVIGATION_FILTER,
  SITES,
  addedFor,
  defaultInstance,
  failoverFilter,
  getRedirect,
  hasInstances,
  instancePool,
  isSiteEnabled,
  overlayNetwork,
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
  const prefs = { customInstances: { invidious: "https://tube.home.example" } };
  const redirect = getRedirect("https://www.youtube.com/watch?v=a#t", {}, prefs);
  assert.equal(redirect.url, "https://tube.home.example/watch?v=a#t");
  assert.equal(redirect.pinned, true);
  assert.equal(getRedirect("https://www.youtube.com/", {}).pinned, false);
});

test("adding an instance turns on a site with no public host", () => {
  for (const [name, service, url, suffix] of [
    ["TikTok", "proxitok", "https://www.tiktok.com/@a", "/@a"],
    ["Odysee", "librarian", "https://odysee.com/@a:1/b:2", "/@a:1/b:2"]
  ]) {
    assert.equal(hasInstances(siteNamed(name)), false, name);
    assert.equal(getRedirect(url, {}), null, name);

    const prefs = { addedInstances: { [service]: ["http://192.168.1.20:8080/x"] } };
    assert.equal(hasInstances(siteNamed(name), prefs), true, name);
    assert.equal(getRedirect(url, {}, prefs).url, `http://192.168.1.20:8080/x${suffix}`, name);
  }
});

test("several added instances replace the public list and fail over among themselves", () => {
  const mine = ["https://a.example", "https://b.example"];
  const added = { invidious: mine };
  assert.deepEqual(instancePool("invidious", added), mine);

  for (let i = 0; i < 20; i++) {
    const redirect = getRedirect("https://www.youtube.com/", {}, { addedInstances: added });
    assert.ok(mine.includes(redirect.instance), "never a public host");
    assert.equal(redirect.pinned, false);
  }
  assert.equal(pickInstance("invidious", ["https://a.example"], { addedInstances: added }), "https://b.example");
  assert.equal(pickInstance("invidious", mine, { addedInstances: added }), null, "no public fallback");
});

test("an instance of any frontend serves its site", () => {
  const added = { piped: ["https://piped.home.example"], invidious: ["https://inv.home.example"] };
  assert.deepEqual(addedFor("invidious", added).sort(), ["https://inv.home.example", "https://piped.home.example"]);
  assert.equal(getRedirect("https://youtube.com/", {}, { addedInstances: { piped: ["https://piped.home.example"] } }).instance, "https://piped.home.example");
});

test("search projects keep their added instances to themselves", () => {
  const added = { whoogle: ["https://w.home.example"] };
  assert.deepEqual(instancePool("whoogle", added), ["https://w.home.example"]);
  assert.deepEqual(instancePool("4get", added), INSTANCES["4get"]);
  assert.deepEqual(instancePool("searx", added), []);
});

test("failover watches added hosts as well as the bundled ones", () => {
  const hosts = failoverFilter({ redlib: ["http://192.168.1.20:8080/r"] }).url.map((rule) => rule.hostEquals);
  assert.ok(hosts.includes("192.168.1.20"));
  assert.ok(hosts.includes("safereddit.com"));
});

test("turning a site off beats its chosen and added instances", () => {
  const customMap = Object.fromEntries(siteNamed("YouTube").hosts.map((host) => [host, ""]));
  assert.equal(getRedirect("https://youtube.com/", customMap, {
    customInstances: { invidious: "https://tube.home.example" },
    addedInstances: { invidious: ["https://a.example"] }
  }), null);
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

test("directory.js holds every host in the saved Farside files, including fallbacks", () => {
  const read = (name) => readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8");
  const expected = {};
  const add = (service, url) => {
    expected[service] ??= new Set();
    if (url) expected[service].add(url.split("|")[0].replace(/\/+$/, ""));
  };

  for (const file of ["farside-services-full-af08778f3c.json", "farside-services-af08778f3c.json"]) {
    for (const entry of JSON.parse(read(file))) {
      add(entry.type);
      [entry.fallback, ...entry.instances].forEach((url) => add(entry.type, url));
    }
  }
  let current = null;
  for (const line of read("farside-snapshot-2026-07-19.md").split("\n")) {
    current = line.match(/^\* \[([^\]]+)\]/)?.[1] ?? current;
    const host = line.match(/^\s+\* (https:\/\/\S+)/);
    if (host) add(current, host[1]);
  }

  assert.deepEqual(
    Object.fromEntries(Object.entries(KNOWN_INSTANCES).map(([service, hosts]) => [service, [...hosts].sort()])),
    Object.fromEntries(Object.entries(expected).map(([service, hosts]) => [service, [...hosts].sort()]))
  );
  assert.ok(KNOWN_INSTANCES.piped.includes("https://piped.ducks.party"), "Piped keeps the frontend, not the API");
  assert.ok(!Object.values(KNOWN_INSTANCES).flat().some((url) => url.includes("|")));
});

test("each install has one default, and installs spread across the list", () => {
  const pool = INSTANCES.rimgo;
  const seen = new Set();
  for (let seed = 0; seed < pool.length; seed++) {
    const prefs = { seed };
    const first = defaultInstance("rimgo", prefs);
    assert.equal(first, defaultInstance("rimgo", prefs), "stable for an install");
    assert.equal(getRedirect("https://imgur.com/a", {}, prefs).instance, first, "the default is what redirects use");
    seen.add(first);
  }
  assert.equal(seen.size, pool.length);
});

test("failover from a default still reaches every host once", () => {
  const prefs = { seed: 3 };
  const tried = [];
  for (let next = pickInstance("rimgo", tried, prefs); next; next = pickInstance("rimgo", tried, prefs)) {
    tried.push(next);
  }
  assert.deepEqual([...tried].sort(), [...INSTANCES.rimgo].sort());
});

test("added instances and a chosen host win over the install's default", () => {
  const added = { addedInstances: { rimgo: ["https://b.example", "https://a.example"] }, seed: 5 };
  assert.equal(defaultInstance("rimgo", added), "https://b.example", "first added, in the order added");
  assert.equal(defaultInstance("rimgo", { ...added, customInstances: { rimgo: "https://c.example" } }), "https://c.example");
  assert.equal(defaultInstance("proxitok", { seed: 5 }), null);
});

test("the check skips overlay hosts and includes added ones", () => {
  assert.equal(overlayNetwork("http://abc.onion"), "Tor only");
  assert.equal(overlayNetwork("https://inv.nadeko.ygg"), "Yggdrasil only");
  assert.equal(overlayNetwork("https://nitter.net"), null);

  const hosts = hostsToCheck({ redlib: ["https://mine.example"] });
  assert.ok(hosts.includes("https://mine.example"));
  assert.ok(hosts.includes("https://redlib.freedit.eu"), "fallbacks are checked");
  assert.ok(!hosts.some((url) => overlayNetwork(url)));
  assert.equal(new Set(hosts).size, hosts.length);
});

test("isLive reports whether a server answered, without sending anything personal", async () => {
  let options;
  assert.equal(await isLive("https://a.example", async (_, opts) => { options = opts; return {}; }), true);
  assert.equal(options.mode, "no-cors");
  assert.equal(options.credentials, "omit");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(await isLive("https://b.example", async () => { throw new TypeError("Failed to fetch"); }), false);
});

test("checkAll answers for every host and reports progress", async () => {
  const hosts = Array.from({ length: 40 }, (_, i) => `https://h${i}.example`);
  const progress = [];
  const results = await checkAll(hosts, (done) => progress.push(done), async (url) => {
    if (url.endsWith("7.example")) throw new TypeError("Failed to fetch");
    return {};
  });
  assert.equal(Object.keys(results).length, 40);
  assert.equal(results["https://h7.example"], false);
  assert.equal(results["https://h8.example"], true);
  assert.equal(progress.at(-1), 40);
});

test("catalog covers everything the UI looks up", () => {
  const services = PROJECTS.map((project) => project.service);
  assert.equal(new Set(services).size, services.length, "one entry per project");

  for (const site of SITES) {
    assert.ok(services.includes(site.service), `${site.name} has a project`);
    assert.ok(PROJECTS.some((project) => project.replaces === site.name), `${site.name} has a group`);
  }
  for (const service of Object.keys(KNOWN_INSTANCES)) {
    assert.ok(services.includes(service), `known service ${service} is listed`);
  }
  for (const url of [...PROJECTS.map((project) => project.repo), ...SOURCES.map((source) => source.url)]) {
    assert.ok(url.startsWith("https://"), url);
  }
  const hosts = Object.values(INSTANCES).flat();
  for (const url of Object.keys(INSTANCE_NOTES)) {
    assert.ok(hosts.includes(url), `note for ${url} matches a host`);
  }
});
