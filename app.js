// app.js
// Tab switching and rendering for the popup and the options page

import { VIEWS, clearStamps, isEditingInstance, loadSettings } from "./ui.js";

const main = document.getElementById("view");
const tabs = [...document.querySelectorAll("[data-view]")];

let currentView = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "sites";

function render(focusService) {
  // Put focus and scroll back after a re-render, so people stay on the control they just used
  const focusedId = document.activeElement?.id;
  const scrollTop = main.scrollTop;

  main.replaceChildren();
  VIEWS[currentView](main, navigate, focusService);
  clearStamps();

  tabs.forEach((tab) => {
    if (tab.dataset.view === currentView) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  if (focusService) return;
  if (focusedId) document.getElementById(focusedId)?.focus();
  main.scrollTop = scrollTop;
}

function navigate(view, focusService) {
  currentView = view;
  history.replaceState(null, "", `#${view}`);
  main.scrollTop = 0;
  render(focusService);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => navigate(tab.dataset.view));
});

// Opening or closing an add-instance form only changes this view
main.addEventListener("redraw", () => render());

document.getElementById("open-options")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Keeps the popup and options page in step, without clearing an address someone is still typing
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  await loadSettings();
  if (!isEditingInstance()) render();
});

await loadSettings();
render();
