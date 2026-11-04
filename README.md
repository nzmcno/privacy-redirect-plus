# PrivacyRedirect+

<p align="center">
  <img src="icons/icon128.png" alt="PrivacyRedirect+ Logo" width="128" height="128">
</p>

<p align="center">
  A Chrome extension that automatically redirects popular websites to privacy-respecting alternatives.
</p>

<p align="center">
  <a href="https://github.com/nzmcno/privacy-redirect-plus/stargazers"><img src="https://img.shields.io/github/stars/nzmcno/privacy-redirect-plus" alt="GitHub stars"></a>
  <a href="https://github.com/nzmcno/privacy-redirect-plus/issues"><img src="https://img.shields.io/github/issues/nzmcno/privacy-redirect-plus" alt="GitHub issues"></a>
  <a href="https://github.com/nzmcno/privacy-redirect-plus/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nzmcno/privacy-redirect-plus" alt="License"></a>
</p>

## 💾 Installation

<p align="center">
  <a href="https://chromewebstore.google.com/detail/privacyredirect+/hgddaoemcmlgbhjcnolmdnhfmmpblihf"><img src="https://img.shields.io/badge/Chrome-Get_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Web Store"></a>
  <a href="#"><img src="https://img.shields.io/badge/Firefox-Get_Add--on-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Firefox Add-ons"></a>
  <a href="#"><img src="https://img.shields.io/badge/Edge-Get_Extension-0078D7?style=for-the-badge&logo=microsoft-edge&logoColor=white" alt="Edge Add-ons"></a>
</p>

## 💖 Support the Project

If you find PrivacyRedirect+ useful, consider supporting its development:

<p align="center">
  <a href="https://www.buymeacoffee.com/nzmcno" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
</p>

<p align="center">
  <strong>Cryptocurrency Donations:</strong><br>
  Bitcoin (BTC): <code>bc1qj629vmsvm0jv2jej582u95wftnxyfdqe6almfg</code><br>
  Ethereum (ETH): <code>0x6B675217f30BdBF5aB56b0f8fb696C28a0c74311</code><br>
  Solana (SOL): <code>FsqY73gKLpadjKiiBQYodPCEL66R9vxZUBiNKpMc3RtA</code>
</p>

## 🚀 Features

- **Automatic Redirects:** Seamlessly redirects major platforms to privacy-friendly alternatives
- **Highly Customizable:** Enable/disable redirects on a per-site basis
- **Quick Access Panel:** Easily access all supported privacy frontends with one click
- **Clean UI:** Simple, intuitive interface with categorized services
- **No Tracking:** Zero data collection, completely respects your privacy

## 🔄 Supported Redirects

| Platform         | Redirects to    | Description                         |
| ---------------- | --------------- | ----------------------------------- |
| YouTube          | Invidious       | Privacy-respecting YouTube frontend |
| Twitter/X        | Nitter          | Lightweight Twitter frontend        |
| Reddit           | Redlib          | Private Reddit frontend             |
| Wikipedia        | Wikiless        | Privacy-focused Wikipedia frontend  |
| GitHub           | GotHub          | Alternative GitHub frontend         |
| Medium           | Scribe          | Medium without the clutter          |
| Imgur            | Rimgo           | Privacy-friendly Imgur frontend     |
| Google Translate | SimplyTranslate | Privacy-respecting translator       |
| Fandom           | BreezeWiki      | Better Fandom experience            |
| Genius           | Dumb            | Clean, fast lyrics site             |
| Bandcamp         | Tent            | Alternative Bandcamp frontend       |

### Currently not redirected

Instagram (Proxigram), TikTok (ProxiTok), Stack Overflow (AnonymousOverflow), Quora (Quetre) and IMDB (LibreMDB) have no working instance on the bundled list, so these sites open normally.

### Where the instances come from

[Farside](https://github.com/benbusby/farside), which used to choose an instance for this extension, shut down in August 2026. The hosts in [`redirects.js`](redirects.js) come from its final `services.json`, minus the ones that were unreachable or broken when checked on 2026-11-04. Dumb had no working host there, so its hosts come from [LibRedirect](https://github.com/libredirect/instances). The list is bundled with the extension and is not fetched at runtime. Nothing checks instance health ahead of time: the extension tries another instance if one can't be reached, but an instance that responds with an error page or a visitor check is shown as is.

## 🔎 Quick Access Services

PrivacyRedirect+ provides quick access to various privacy-focused services:

### Search

- Whoogle - Privacy-respecting Google search
- SearXNG - Metasearch engine
- 4get - Privacy-oriented search engine
- Librey - Open search engine

### Translation

- Lingva - Private translation service
- SimplyTranslate - Simple translation alternative

### Social Media

- Nitter - Twitter frontend
- Redlib - Reddit frontend

### Other Services

- Invidious - YouTube frontend
- Gothub - GitHub frontend
- Wikiless - Wikipedia frontend
- Scribe - Medium frontend
- Rimgo - Imgur frontend
- BreezeWiki - Fandom frontend
- Dumb - Genius.com frontend
- Tent - Bandcamp frontend

## 📦 Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the repository folder
5. The extension is now installed and ready to use!

## 🔧 Usage

1. Click the PrivacyRedirect+ icon in your browser toolbar
2. Toggle individual sites on/off as needed
3. Access the "Quick Access" tab for direct links to privacy services

## ⚙️ Configuration

PrivacyRedirect+ can be configured through:

- The popup interface (quick toggles)
- The options page (full settings)

To access the options page, either:

- Click the "Settings" button in the popup
- Right-click the extension icon and select "Options"

## 🔒 Privacy

PrivacyRedirect+ is designed with privacy in mind:

- No data collection
- No analytics
- No background requests: the only traffic is the page you were going to visit, sent to the alternative service instead
- Settings are kept in Chrome's sync storage, so they follow your Google account if Chrome Sync is on

For more details, see our [Privacy Policy](PRIVACY.md).

## ⚠️ Disclaimer

Please note that PrivacyRedirect+ is not affiliated with any of the websites it redirects to or from. We cannot guarantee the availability or privacy practices of third-party services. See our [Disclaimer](DISCLAIMER.md) for more information.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Run the tests with `npm test` (requires Node.js 20 or newer, no dependencies to install).

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
