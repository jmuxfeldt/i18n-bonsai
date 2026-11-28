# ![](./src-tauri/icons/128x128.png) i18n Bonsai

A desktop app for editing i18n translation JSON files. Built with Tauri 2, Vue 3, Naive UI, and TypeScript.
- [Home Page](https://jmuxfeldt.github.io/i18n-bonsai/#top)
- [Documentation](https://jmuxfeldt.github.io/i18n-bonsai/#docs)
- [Troubleshooting](https://jmuxfeldt.github.io/i18n-bonsai/#doc-troubleshooting)

**[⬇ Download latest release](https://github.com/jmuxfeldt/i18n-bonsai/releases/latest)** · **[All releases](https://github.com/jmuxfeldt/i18n-bonsai/releases)**

- Load a directory of locale files (e.g. `en.json`, `de.json`, `fr.json`)
- Edit translations in a side-by-side grid
- Auto-translate missing entries via the OpenAI API
- Add per-item AI context instructions (saved in a `context.json` file)
- Add global AI context instructions
- Changes are saved back to the original files

## Support this project 💚

i18n Bonsai is free and open source. So if this app saves you time, or you'd simply like to see it keep growing, please consider chipping in toward its continued development. Every contribution, however small, means a lot.

[![Donate using Liberapay](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/jmuxf/donate)

I am happy to consider feature requests! 

Thank you! 🙏

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) stable 1.77+
- **macOS**: Xcode Command Line Tools — `xcode-select --install`
- **Linux**: `libwebkit2gtk-4.1`, `libappindicator3`, `librsvg2` (see [Tauri prereqs](https://tauri.app/start/prerequisites/))
- **Windows**: Microsoft C++ Build Tools + WebView2 (pre-installed on Windows 11)

- source or translation files should be of format en.json, de.json, etc. and must contain at least {}

```bash
npm install
```

### Run with Tauri (native window + file system access)

```bash
npm run tauri:dev
```

Starts the Vite dev server and opens the app in a native window. Hot-reload is active for the Vue frontend.

### Run in browser only (no file system access)

```bash
npm run dev
```

Opens at `http://localhost:3020`. "npm run dev" uses demo translation data only and does not save changes.


## Building

```bash
# macOS (universal binary)
npm run tauri:build -- --target universal-apple-darwin

# macOS (native arch only)
npm run tauri:build

# Windows / Linux
npm run tauri:build
```

Output is written to `src-tauri/target/release/bundle/`.


## Publishing a DMG on GitHub

Build the app (see above). The DMG is written to `src-tauri/target/release/bundle/dmg/`
(for a universal build: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`).

### Manually (in the browser)

No tools needed beyond the built DMG.

1. Open the repo on GitHub and click **Releases**.
2. Click **Draft a new release** (or the pencil icon to edit an existing release).
3. Choose or create a tag, e.g. `v0.1.0`, and add a title.
4. Drag the `.dmg` into the "Attach binaries" box.
5. Click **Publish release** (or **Update release**).

### With the GitHub CLI

```bash
brew install gh
gh auth login

# New release
gh release create v1.0.5 src-tauri/target/release/bundle/dmg/*.dmg --title "v1.0.5"

# Add to an existing release (--clobber replaces a file with the same name)
gh release upload v1.0.5 src-tauri/target/release/bundle/dmg/*.dmg --clobber
```

To open the output folder in Finder: `open src-tauri/target/release/bundle/dmg/`

Note: unsigned / un-notarized apps trigger a "damaged app" or "unidentified developer" warning on other Macs.
