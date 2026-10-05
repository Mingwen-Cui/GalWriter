# GalWriter Quick Start

GalWriter helps you create visual novels, branching stories, and interactive presentations. Build on the canvas, play through the story, and export your work.

## Get started

1. Download the Windows app from [GitHub Releases](https://github.com/Mingwen-Cui/GalWriter/releases). **Lite is recommended**: it is smaller and fetches preset images, music, and templates online as needed. Choose Full for bundled offline resources.
2. Create a project, add story cards, and connect them to define choices and branches.
3. Add characters, scenes, and numeric conditions. Configure a provider and API key in **Settings → AI** for AI features.
4. Use Playtest to review choices and presentation, then open the Web, video, PPT, or code workspace to export.
5. Export a project ZIP regularly for backup and later editing.

## Connect Codex with MCP

MCP is available in the Windows desktop app. Start GalWriter, open Assistant → **AI MCP**, and copy the connection prompt into local Codex. The endpoint is `http://127.0.0.1:38941/mcp`; keep GalWriter running while connected. The browser version cannot reach an MCP server on a visitor's computer.

## Data and privacy

Projects and AI profiles are stored locally. API keys are excluded from project ZIPs by default. Lite and its online preset resources require an internet connection.

## Links

- [Releases](https://github.com/Mingwen-Cui/GalWriter/releases)
- [Build and release guide](build/BUILD_GUIDE.en.md)
- [Report an issue](https://github.com/Mingwen-Cui/GalWriter/issues)
