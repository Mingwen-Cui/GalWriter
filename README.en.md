# GalWriter AI User Guide

<p align="center">
  <img src="./public/icon.png" alt="GalWriter AI" width="96" />
</p>

GalWriter AI is an interactive editor for visual novels, galgames, branching narratives, and multi-path script writing. It keeps story nodes, character and scene data, AI continuation, image generation, voice narration, live testing, and project export in one creative canvas, which makes it easier to organize complex plots, try out branching ideas quickly, manage assets, and hand work off to later production steps.

This guide is for users. It explains how to create projects, configure APIs, import API templates, and use AI while writing.

## Language Switch

- 中文：[README.md](README.md)
- English (current)：[README.en.md](README.en.md)
- 日本語：[README.ja.md](README.ja.md)

## Quick Start

If this is your first time using GalWriter AI, follow these steps:

1. Open the app and click **Create Project** on the project home page, or import an existing project.
2. Add story, character, scene, and background nodes to the canvas, then connect them into branches.
3. Open **Settings** and configure Text AI, Image AI, or Voice AI. You can skip this step if you do not need AI yet.
4. When you need content generation, open **AI Assistant**, use AI continuation, or call image and voice features from the corresponding nodes.
5. Save the project when you are done, then export it for backup or handoff.

Also:

- If you want to understand the layout first, see **Quick Tour of the Interface** below.
- If you want to configure APIs, jump to **API Setup**, **Text AI API**, **Image AI API Import**, and **Voice AI API**.

## Local Development and Build

### Install dependencies

```bash
npm install
```

### Run the web app locally

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Run the desktop app in development

```bash
npm run tauri dev
```

This starts the frontend dev server and opens the Tauri desktop window.

### Build the web app

```bash
npm run build
```

The build output is written to `dist/`. You can use `npm run preview` to check the static build locally.

### Package the desktop app

```bash
npm run tauri build
```

This runs the frontend build first, then generates the desktop installer and platform-specific release artifacts.

### Preview the static build

```bash
npm run preview
```

Use this to preview the `dist/` output locally.

To run or package the desktop app, make sure Rust and the Tauri toolchain are installed. If you only want the browser version, Node.js and npm are enough.

## Quick Tour of the Interface

- **Project Home**: create new projects, import existing projects, open recent projects, or batch download/delete projects.
- **Main Canvas**: place and connect story, character, scene, background, condition, and other node types.
- **Left Toolbar**: add different kinds of nodes and assets.
- **Right Toolbar**: open settings, toggle title display, undo/redo, change the canvas background, or open the AI assistant.
- **AI Assistant Panel**: chat with AI, upload reference documents, and insert or apply generated content to the current project.
- **Settings Panel**: configure AI providers, canvas appearance, prompt templates, and AI continuation buttons.

## First Time Use

1. Open the app and click **Create Project** on the project home page.
2. Add story, character, scene, or background nodes on the canvas.
3. Connect the nodes to build a branching structure.
4. If you want to use AI, open **Settings** and finish API configuration first.
5. Save the project and reopen it later from **Recent Projects**.

## API Setup

1. Click **Settings** in the editor's right toolbar.
2. Find the **AI API Configuration** section.
3. Choose the type you want to configure:
   - **Text AI**: for continuation, polishing, analysis, conversation, and the AI assistant.
   - **Image AI**: for generating character, scene, and background images.
   - **Voice AI**: for text-to-speech or voice generation.
4. Click **New Configuration** in the top-right corner of the corresponding section.
5. Fill in the configuration name, Provider, Model, API Key, and API URL.
6. Click **Save**.
7. Go back to the configuration list and click the configuration you just saved to make it active.

AI configurations are stored only on the current device and are not exported with the project. If you switch computers, you need to enter the API configuration again.

## Text AI API

Text AI powers most writing features, including AI continuation, idea generation, rewriting, story insertion, scene description, dialogue completion, and the AI assistant.

Common examples:

| Provider | API URL Example | Model Example |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` / `deepseek-reasoner` |
| Gemini | `https://generativelanguage.googleapis.com` | `gemini-2.5-flash` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1` |
| Claude | `https://api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` |
| Kimi | `https://api.moonshot.cn/v1` | `kimi-k2.5` |
| Tongyi Qianwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3.6-plus` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-5` |
| Custom | Use the endpoint provided by your provider | Use the model name provided by your provider |

Tips:

- **API Key**: paste the key generated in the provider console.
- **API URL**: use the default value first; if you use a proxy, compatible endpoint, or relay service, change it to the corresponding address.
- **Model**: you can pick from the dropdown or enter a custom model name manually.
- **Thinking mode**: suitable for models such as `deepseek-reasoner` that support reasoning output; turn it off for normal chat models.

After saving, the Text AI configuration is used by AI continuation, the AI assistant, and AI summary analysis.

## Image AI API Import

The Image AI configuration page supports importing templates from the clipboard. This is the recommended way, especially if you copy curl, JSON, or official examples from a provider document.

Steps:

1. Copy an image generation example from the provider console or official docs.
2. The example should preferably include these fields:
   - `api_key` / `apiKey` / `OPENAI_API_KEY` / `ARK_API_KEY`
   - `base_url` / `baseURL` / `api_url` / `endpoint`
   - `model`
   - `size`
3. Return to GalWriter AI.
4. Open **Settings > AI API Configuration > Image AI > New Configuration**.
5. Choose a Provider, or select **Custom**.
6. Click **Import Template**.
7. The app will try to read the clipboard and fill in the API URL, API Key, Model, and size.
8. Check the result and adjust it manually if needed.
9. Click **Save**, then select the saved configuration in the Image AI list.

Example template:

```bash
curl https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "a visual novel background",
    "size": "1024x1024"
  }'
```

Or:

```json
{
  "api_key": "YOUR_API_KEY",
  "base_url": "https://api.example.com/v1/images/generations",
  "model": "example-image-model",
  "size": "1024x1024"
}
```

If import says no usable fields were found, you can fill these in manually:

- **API URL**: the image generation endpoint.
- **API Key**: the provider key.
- **Model**: the image model name.
- **Size**: the output size, such as `1024x1024`.

## Voice AI API

Voice AI turns text into speech. You can use the built-in system voice, or configure an online voice service.

- **System voice**: uses the desktop app's built-in speech capability and does not require an API Key.
- **Youdao voice**: fill in the App Key and App Secret.
- **OpenAI voice**: fill in the API Key, API URL, Model, and Voice.
- **Doubao / Gemini / custom voice**: fill in the API URL, API Key, Model, and Voice according to the provider's requirements.

Voice is the voice name, such as `alloy`, `Kore`, or the Chinese voice ID provided by the service.

## How to Confirm the API Is Working

After you save and select a configuration, test it like this:

- Text AI: select a story node, click AI continuation, or send a test message in the AI Assistant.
- Image AI: try generating an image from a character, scene, or background feature.
- Voice AI: trigger voice generation or playback for content that supports narration.

If something fails, check the following first:

- The API Key has no extra spaces.
- The API URL points to the correct endpoint level.
- The Model name matches the provider documentation.
- The correct configuration is selected and active.
- Your account has enough credit, quota, or model access.
- Your network can reach the provider.

## Project Management

### Create and open projects

- Click **Create Project** to start from an empty canvas.
- Click any project card in Recent Projects to open it.
- Use the buttons on the project card to download, rename, or delete that project.

### Batch project actions

After clicking **Batch Select** on the project home page, you can choose multiple recent projects:

- **Download**: export the selected projects one by one.
- **Delete**: delete the selected projects in batch; confirmation is required before deletion.

### Import and export

- **Import existing project**: choose a previously exported project file and load it again.
- **Download / Export project**: exports the project structure and related assets for backup, migration, or handoff.

## Basic Creative Workflow

1. Add story nodes and write the main text, choices, or branch content.
2. Add character, scene, and background nodes to build your asset and lore library.
3. Connect nodes with arrows to form the story flow.
4. Use AI continuation, polishing, or analysis to fill content faster.
5. Use live testing to check the branching experience from the player's point of view.
6. Save the project and export it when needed.

## AI Writing Features

After configuring Text AI, you can use:

- **Continue from previous text**: continue writing from existing story content.
- **Creative branching**: generate multiple possible directions.
- **Polish and rewrite**: keep the information but improve the wording.
- **Story insertion**: add bridging content between existing sections.
- **Scene description**: strengthen atmosphere, environment, and camera feel.
- **Dialogue completion**: fill in lines based on the character and context.
- **AI summary analysis node**: connect multiple nodes and summarize plot logic, character state, and context.

You can also adjust the **AI continuation buttons** in Settings to keep only the actions you use most often.

## Custom Prompts

In the Settings panel, you can edit the AI prompt templates. This is useful when:

- you want the AI to follow a fixed writing style,
- you want the AI to pay more attention to character setup,
- you want to change the output format for continuation, polishing, or story insertion,
- or you want to adapt the workflow to your own production pipeline or team rules.

Prompt templates are saved with the current project. Different projects can use different prompts.

## FAQ

### Why is AI still unavailable after I entered an API Key?

Make sure the configuration has been saved and selected in the configuration list. A draft that has not been saved is not active.

### Should the API URL be a base URL or the full endpoint?

It depends on the provider. Use the address prefilled by the app first; if you are using a custom or relay service, follow the provider's documentation. Image generation endpoints usually require a more complete image endpoint URL.

### Does importing an image API template save clipboard contents?

No. Importing a template only reads the current clipboard text and tries to recognize fields. The result is written into the current configuration form. Only after you click Save will the configuration be stored locally.

### Will project export include API Keys?

No. AI API configurations are stored only on the current device and are not exported with the project, so secrets are kept out of project files.

### Can I configure multiple APIs?

Yes. You can save multiple configurations for text, image, and voice AI. When you want to switch, just click the one you want in the configuration list.

## Local Stable Diffusion WebUI

The Image AI Provider can be set to **Local Stable Diffusion WebUI** to connect to a local AUTOMATIC1111 WebUI instance.

1. Start Stable Diffusion WebUI with the API enabled, for example by adding `--api` to the startup flags.
2. If the browser or desktop app reports a CORS block, you can also add `--cors-allow-origins=*`, or allow only the current app address.
3. In the app, open **Settings > AI API Configuration > Image AI > New Configuration**.
4. Set the Provider to **Local Stable Diffusion WebUI**.
5. The API URL is usually `http://127.0.0.1:7860`; you can also use the full endpoint `http://127.0.0.1:7860/sdapi/v1/txt2img`.
6. The API Key is usually left blank.
7. You can adjust negative prompts, Steps, CFG Scale, Sampler, Seed, Restore Faces, and Hires Fix.

This provider calls `POST /sdapi/v1/txt2img` and writes the returned base64 image directly into story cards, character cards, or scene cards.

Created by Mingwen Cui, Tommy Ren.
