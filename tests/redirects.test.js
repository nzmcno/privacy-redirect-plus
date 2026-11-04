import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATEGORIZED_QUICK_LINKS,
  INSTANCES,
  NAVIGATION_FILTER,
  SITES,
  getRedirect,
  hasInstances,
  isSiteEnabled,
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

test("listener filter covers exactly the sites that can redirect", () => {
  const filtered = NAVIGATION_FILTER.url.map((rule) => rule.hostEquals).filter(Boolean);
  const expected = SITES.filter(hasInstances).flatMap((site) => site.hosts);
  assert.deepEqual(filtered, expected);
});
