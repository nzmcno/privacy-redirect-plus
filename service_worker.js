// service_worker.js
// Chrome Extension Background Script for PrivacyRedirect+
// Redirects popular domains to their privacy-focused alternatives

import { runInstanceCheck } from "./checker.js";
import { NAVIGATION_FILTER, failoverFilter, getRedirect, loadInstallSeed, pickInstance } from "./redirects.js";

// Failures that say nothing about the instance, so trying another one wouldn't help
const NON_RETRYABLE_ERRORS = new Set([
  "net::ERR_ABORTED",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_INTERNET_DISCONNECTED"
]);

let customMap = {};
let prefs = { customInstances: {}, addedInstances: {}, seed: 0 };

// Redirects still loading, by tab, so a failed instance can be swapped for another
const activeRedirects = new Map();

function navigateTab(tabId, url) {
  chrome.tabs.update(tabId, { url }).catch((error) => {
    console.error("Error redirecting tab:", error);
  });
}

// Nothing checks instance health ahead of time, so move on to another one if this one can't be reached.
// HTTP errors from a reachable instance still load as pages and can't be detected here.
function onInstanceFailed(details) {
  const redirect = activeRedirects.get(details.tabId);
  if (details.frameId !== 0 || !redirect) return;

  const instance = NON_RETRYABLE_ERRORS.has(details.error)
    ? null
    : pickInstance(redirect.service, redirect.tried, prefs);

  if (!instance) {
    activeRedirects.delete(details.tabId);
    return;
  }

  redirect.tried.push(instance);
  const { pathname, search, hash } = new URL(details.url);
  navigateTab(details.tabId, instance + pathname + search + hash);
}

function onInstanceLoaded(details) {
  if (details.frameId === 0) activeRedirects.delete(details.tabId);
}

// Registered once settings are known, because the filter includes instances the user added.
// Failover only runs just after a redirect, while the worker is awake, so these needn't wake it.
function watchInstances() {
  const filter = failoverFilter(prefs.addedInstances);
  chrome.webNavigation.onErrorOccurred.removeListener(onInstanceFailed);
  chrome.webNavigation.onCommitted.removeListener(onInstanceLoaded);
  chrome.webNavigation.onErrorOccurred.addListener(onInstanceFailed, filter);
  chrome.webNavigation.onCommitted.addListener(onInstanceLoaded, filter);
}

// The worker stops when idle and restarts for the navigation that wakes it, so that
// navigation has to wait for saved settings rather than being skipped.
const settingsReady = Promise.all([
  chrome.storage.sync.get(["customMap", "customInstances", "addedInstances"]),
  loadInstallSeed()
]).then(([res, seed]) => {
  customMap = res.customMap ?? {};
  prefs = { customInstances: res.customInstances ?? {}, addedInstances: res.addedInstances ?? {}, seed };
  watchInstances();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "checkInstances") {
    runInstanceCheck().catch((error) => console.error("Error checking instances:", error));
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.installSeed) prefs.seed = changes.installSeed.newValue ?? 0;
  if (area !== "sync") return;
  if (changes.customMap) customMap = changes.customMap.newValue ?? {};
  if (changes.customInstances) prefs.customInstances = changes.customInstances.newValue ?? {};
  if (changes.addedInstances) {
    prefs.addedInstances = changes.addedInstances.newValue ?? {};
    watchInstances();
  }
});

// Core redirection logic using webNavigation API for Manifest V3
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only process main frame navigations (not iframes, etc)
  if (details.frameId !== 0) return;

  await settingsReady;

  const redirect = getRedirect(details.url, customMap, prefs);
  if (!redirect) return;

  if (redirect.pinned) {
    activeRedirects.delete(details.tabId);
  } else {
    activeRedirects.set(details.tabId, { service: redirect.service, tried: [redirect.instance] });
  }
  navigateTab(details.tabId, redirect.url);
}, NAVIGATION_FILTER);
