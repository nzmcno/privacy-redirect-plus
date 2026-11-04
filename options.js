// options.js
// Handle UI interactions for the extension options page

import { renderQuickLinks, renderSiteToggles } from "./ui.js";

const settingsTab = document.getElementById("settings-tab");
const quickLinksTab = document.getElementById("quicklinks-tab");
const settingsView = document.getElementById("settings-view");
const quickLinksView = document.getElementById("quicklinks-view");

// Tab switch
settingsTab.onclick = () => {
  settingsView.style.display = "block";
  quickLinksView.style.display = "none";
  settingsTab.classList.add("active");
  quickLinksTab.classList.remove("active");
};

quickLinksTab.onclick = () => {
  settingsView.style.display = "none";
  quickLinksView.style.display = "block";
  quickLinksTab.classList.add("active");
  settingsTab.classList.remove("active");
  renderQuickLinks(document.getElementById("quicklinks-container"));
};

renderSiteToggles(document.getElementById("site-options"));
