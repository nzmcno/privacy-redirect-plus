// checker.js
// Runs the Check instances button. Lives in the service worker so closing the popup doesn't stop it.

import { KNOWN_INSTANCES } from "./directory.js";
import { INSTANCES, overlayNetwork } from "./redirects.js";

const CONCURRENCY = 12;
const TIMEOUT_MS = 8000;
const PROGRESS_INTERVAL_MS = 1500;

let running = false;

export function hostsToCheck(addedInstances = {}) {
  const hosts = new Set([
    ...Object.values(INSTANCES).flat(),
    ...Object.values(KNOWN_INSTANCES).flat(),
    ...Object.values(addedInstances).flat()
  ]);
  return [...hosts].filter((url) => !overlayNetwork(url));
}

// With no host permissions the response is opaque, so this only learns whether the server answered,
// not whether the page behind it works.
export async function isLive(url, fetchFn = fetch) {
  try {
    await fetchFn(url, {
      method: "HEAD",
      mode: "no-cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkAll(hosts, onProgress, fetchFn = fetch) {
  const results = {};
  let next = 0;
  let done = 0;

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < hosts.length) {
      const url = hosts[next++];
      results[url] = await isLive(url, fetchFn);
      done++;
      onProgress(done);
    }
  }));

  return results;
}

export async function runInstanceCheck() {
  if (running) return;
  running = true;

  try {
    const { addedInstances } = await chrome.storage.sync.get("addedInstances");
    const { instanceCheck } = await chrome.storage.local.get("instanceCheck");
    const hosts = hostsToCheck(addedInstances);
    const base = { results: instanceCheck?.results ?? {}, finishedAt: instanceCheck?.finishedAt ?? null, total: hosts.length };

    await chrome.storage.local.set({ instanceCheck: { ...base, done: 0, running: true, updatedAt: Date.now() } });

    let lastWrite = 0;
    const results = await checkAll(hosts, (done) => {
      if (Date.now() - lastWrite < PROGRESS_INTERVAL_MS) return;
      lastWrite = Date.now();
      chrome.storage.local.set({ instanceCheck: { ...base, done, running: true, updatedAt: lastWrite } });
    });

    await chrome.storage.local.set({
      instanceCheck: { results, finishedAt: Date.now(), total: hosts.length, done: hosts.length, running: false, updatedAt: Date.now() }
    });
  } finally {
    running = false;
  }
}
