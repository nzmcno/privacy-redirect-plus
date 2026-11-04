// service_worker.js
// Chrome Extension Background Script for PrivacyRedirect+
// Redirects popular domains to their privacy-focused alternatives

import { INSTANCE_FILTER, NAVIGATION_FILTER, getRedirect, pickInstance } from "./redirects.js";

// Failures that say nothing about the instance, so trying another one wouldn't help
const NON_RETRYABLE_ERRORS = new Set([
  "net::ERR_ABORTED",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_INTERNET_DISCONNECTED"
]);

let customMap = {};
let customInstances = {};

// The worker stops when idle and restarts for the navigation that wakes it, so that
// navigation has to wait for saved settings rather than being skipped.
const settingsReady = chrome.storage.sync.get(["customMap", "customInstances"]).then((res) => {
  customMap = res.customMap ?? {};
  customInstances = res.customInstances ?? {};
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.customMap) customMap = changes.customMap.newValue ?? {};
  if (changes.customInstances) customInstances = changes.customInstances.newValue ?? {};
});

// Redirects still loading, by tab, so a failed instance can be swapped for another
const activeRedirects = new Map();

function navigateTab(tabId, url) {
  chrome.tabs.update(tabId, { url }).catch((error) => {
    console.error("Error redirecting tab:", error);
  });
}

// Core redirection logic using webNavigation API for Manifest V3
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only process main frame navigations (not iframes, etc)
  if (details.frameId !== 0) return;

  await settingsReady;

  const redirect = getRedirect(details.url, customMap, customInstances);
  if (!redirect) return;

  if (redirect.pinned) {
    activeRedirects.delete(details.tabId);
  } else {
    activeRedirects.set(details.tabId, { service: redirect.service, tried: [redirect.instance] });
  }
  navigateTab(details.tabId, redirect.url);
}, NAVIGATION_FILTER);

// Nothing checks instance health ahead of time, so move on to another one if this one can't be reached.
// HTTP errors from a reachable instance still load as pages and can't be detected here.
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  const redirect = activeRedirects.get(details.tabId);
  if (details.frameId !== 0 || !redirect) return;

  const instance = NON_RETRYABLE_ERRORS.has(details.error)
    ? null
    : pickInstance(redirect.service, redirect.tried);

  if (!instance) {
    activeRedirects.delete(details.tabId);
    return;
  }

  redirect.tried.push(instance);
  const { pathname, search, hash } = new URL(details.url);
  navigateTab(details.tabId, instance + pathname + search + hash);
}, INSTANCE_FILTER);

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) activeRedirects.delete(details.tabId);
}, INSTANCE_FILTER);
