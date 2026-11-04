// popup.js
// Handle UI interactions for the extension popup

import { renderQuickLinks, renderSiteToggles } from "./ui.js";

const redirectsTab = document.getElementById("redirects-tab");
const quickAccessTab = document.getElementById("quickaccess-tab");
const redirectsContent = document.getElementById("redirects-tab-content");
const quickAccessContent = document.getElementById("quickaccess-tab-content");

// Tab switching
redirectsTab.addEventListener("click", () => {
  redirectsTab.classList.add("active");
  quickAccessTab.classList.remove("active");
  redirectsContent.style.display = "block";
  quickAccessContent.style.display = "none";
});

quickAccessTab.addEventListener("click", () => {
  quickAccessTab.classList.add("active");
  redirectsTab.classList.remove("active");
  quickAccessContent.style.display = "block";
  redirectsContent.style.display = "none";
  renderQuickLinks(quickAccessContent);
});

// Open the options page when button is clicked
document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

renderSiteToggles(redirectsContent);
