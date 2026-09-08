import { toHex8 } from '../../shared/paint/colorValue';
import type { CodeExportTarget } from '../codeExport/targets/targetTypes';
import type { RenpyExportSettings, RenpyFile } from '../codeExport/types';
import { resolveGameInterface } from './gameInterface';

/** Shared by source preview and ZIP export. No inspector state is read during generation. */
function applyLegacyGameInterface(
  files: RenpyFile[],
  settings: RenpyExportSettings,
  target: CodeExportTarget,
): RenpyFile[] {
  const d = resolveGameInterface(settings.interfaceDesigns, target);
  const x = Math.round((d.width * d.panelX) / 100),
    y = Math.round((d.height * d.panelY) / 100);
  const width = Math.round((d.width * d.panelWidth) / 100),
    height = Math.round((d.height * d.panelHeight) / 100);
  if (target === 'dialogic')
    return files.map((file) => {
      let content = file.content;
      if (file.path === 'project.godot')
        content = content
          .replace(/window\/size\/viewport_width=\d+/, `window/size/viewport_width=${d.width}`)
          .replace(/window\/size\/viewport_height=\d+/, `window/size/viewport_height=${d.height}`)
          .replace(
            /window\/size\/window_width_override=\d+/,
            `window/size/window_width_override=${Math.min(1280, d.width)}`,
          )
          .replace(
            /window\/size\/window_height_override=\d+/,
            `window/size/window_height_override=${Math.round(d.height * Math.min(1, 1280 / d.width))}`,
          );
      if (file.path === 'game/GalWriter.gd')
        content = content
          .replace(
            'const SCREEN = Vector2(1280, 720)',
            `const SCREEN = Vector2(${d.width}, ${d.height})`,
          )
          .replace('var text_speed: float = 45.0', `var text_speed: float = ${d.textSpeed}.0`)
          .replace('theme.default_font_size = 24', `theme.default_font_size = ${d.fontSize}`)
          .replace('style.set_corner_radius_all(14)', `style.set_corner_radius_all(${d.radius})`)
          .replace('fill.color = Color("111827")', `fill.color = Color("${d.background}")`)
          .replace(
            'dialogue_panel.position = Vector2(48, 480)',
            `dialogue_panel.position = Vector2(${x}, ${y})`,
          )
          .replace(
            'dialogue_panel.size = Vector2(1184, 216)',
            `dialogue_panel.size = Vector2(${width}, ${height})`,
          )
          .replace(
            '_panel(Color(0.035, 0.055, 0.10, 0.94))',
            `_panel(Color("${toHex8(d.panelColor, d.panelAlpha)}"))`,
          )
          .replace('Color("9bdcff")', `Color("${d.nameColor}")`)
          .replace(
            'text_label.bbcode_enabled = false',
            `text_label.bbcode_enabled = false\n\ttext_label.add_theme_color_override("default_color", Color("${d.textColor}"))`,
          )
          .replace(
            'text_label.custom_minimum_size = Vector2(0, 130)',
            `text_label.custom_minimum_size = Vector2(0, ${Math.max(24, height - 64 - d.fontSize)})`,
          )
          .replace(
            'choice_scroll.position = Vector2(300, 100)',
            'choice_scroll.position = SCREEN * Vector2(0.25, 0.24)',
          )
          .replace(
            'choice_scroll.size = Vector2(680, 365)',
            'choice_scroll.size = SCREEN * Vector2(0.5, 0.36)',
          )
          .replace(
            'title_panel.position = Vector2(360, 150)',
            'title_panel.position = SCREEN * Vector2(0.28, 0.2)',
          )
          .replace(
            'title_panel.size = Vector2(560, 420)',
            'title_panel.size = SCREEN * Vector2(0.44, 0.6)',
          )
          .replace(
            'button.add_theme_font_size_override("font_size", 20)',
            `button.add_theme_font_size_override("font_size", ${d.fontSize})\n\tbutton.add_theme_color_override("font_color", Color("#ffffff"))\n\tbutton.add_theme_stylebox_override("normal", _panel(Color("${d.accentColor}")))`,
          );
      if (file.path === 'game/story.json') {
        const data = JSON.parse(content);
        data.interfaceDesign = d;
        content = JSON.stringify(data, null, 2) + '\n';
      }
      return { ...file, content };
    });
  if (target === 'renpy') {
    const interfaceFile: RenpyFile = {
      path: 'game/galwriter_interface.rpy',
      generated: true,
      content: `# Generated interface. Edit in GalWriter's Interface design tab.
define config.screen_width = ${d.width}
define config.screen_height = ${d.height}
default preferences.text_cps = ${d.textSpeed}

screen say(who, what):
    window:
        id "window"
        xpos ${x}
        ypos ${y}
        xsize ${width}
        ysize ${height}
        padding (24, 16)
        background Solid("${toHex8(d.panelColor, d.panelAlpha)}")
        vbox:
            spacing 10
            if who is not None:
                text who id "who" size ${d.fontSize} color "${d.nameColor}"
            text what id "what" size ${d.fontSize} color "${d.textColor}"

screen choice(items):
    vbox:
        xpos ${Math.round(d.width * 0.25)}
        ypos ${Math.round(d.height * 0.24)}
        xsize ${Math.round(d.width * 0.5)}
        spacing 12
        for item in items:
            textbutton item.caption:
                action item.action
                xfill True
                padding (24, 12)
                background Solid("${d.accentColor}")
                hover_background Solid("${d.accentColor}cc")
                text_color "#ffffff"
                text_size ${d.fontSize}
`,
    };
    return [
      ...files.map((file) =>
        file.path === 'game/script.rpy'
          ? {
              ...file,
              content: file.content.replace(
                'label start:\n',
                `label start:\n    scene expression Solid("${d.background}")\n`,
              ),
            }
          : file,
      ),
      interfaceFile,
    ];
  }
  if (target === 'tyrano') {
    const setup = `[position layer="message0" page="fore" left="${x}" top="${y}" width="${width}" height="${height}" color="0x${d.panelColor.slice(1)}" opacity="${Math.round((d.panelAlpha * 255) / 100)}"]\n[deffont size="${d.fontSize}" color="0x${d.textColor.slice(1)}"]\n[resetfont]\n[delay speed="${Math.round(1000 / d.textSpeed)}"]\n`;
    return files.map((file) =>
      file.path === 'data/scenario/first.ks'
        ? { ...file, content: `; GalWriter interface design\n${setup}${file.content}` }
        : file,
    );
  }
  return files;
}

/** Native engines consume the same composed artwork as the design panel. */
export function applyGameInterface(
  files: RenpyFile[],
  settings: RenpyExportSettings,
  target: CodeExportTarget,
): RenpyFile[] {
  const d = resolveGameInterface(settings.interfaceDesigns, target);
  return applyLegacyGameInterface(files, settings, target).map((file) => {
    let content = file.content;
    if (target === 'dialogic' && file.path === 'game/GalWriter.gd') {
      if (d.templateId)
        content = content.replaceAll(
          '_panel(Color("18243a"))',
          `_panel(Color("${toHex8(d.panelColor, d.panelAlpha)}"))`,
        );
      if (d.panelAppearance)
        content = content.replace(
          `_panel(Color("${toHex8(d.panelColor, d.panelAlpha)}"))`,
          '_interface_texture("dialogue")',
        );
      if (d.choiceAppearance)
        content = content.replace(
          'parent.add_child(button)',
          'button.add_theme_stylebox_override("normal", _interface_texture("choices"))\n\tbutton.add_theme_stylebox_override("hover", _interface_texture("choices"))\n\tparent.add_child(button)',
        );
      if (d.canvasAppearance)
        content = content.replace(
          'add_child(fill)',
          'add_child(fill)\n\tvar interface_background = TextureRect.new()\n\tinterface_background.texture = load("res://game/galwriter-ui/canvas.png")\n\tinterface_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE\n\tinterface_background.size = SCREEN\n\tinterface_background.mouse_filter = Control.MOUSE_FILTER_IGNORE\n\tadd_child(interface_background)',
        );
      content = content
        .replace(
          'dialogue_panel.z_index = 100',
          `dialogue_panel.z_index = ${100 + (d.layerOrder?.dialogue ?? 1)}`,
        )
        .replace(
          'choice_scroll.z_index = 101',
          `choice_scroll.z_index = ${100 + (d.layerOrder?.choices ?? 2)}`,
        );
      if (d.panelAppearance || d.choiceAppearance)
        content +=
          '\nfunc _interface_texture(surface: String) -> StyleBoxTexture:\n\tvar skin = StyleBoxTexture.new()\n\tskin.texture = load("res://game/galwriter-ui/" + surface + ".png")\n\tskin.set_content_margin_all(16.0)\n\treturn skin\n';
    }
    if (target === 'renpy') {
      if (file.path === 'game/galwriter_interface.rpy') {
        if (d.templateId)
          content += `\n# Shared template palette for main menu, preferences and save/load screens.\ndefine gui.accent_color = "${d.accentColor}"\ndefine gui.text_color = "${d.textColor}"\ndefine gui.interface_text_color = "${d.textColor}"\ndefine gui.idle_color = "${d.textColor}"\ndefine gui.hover_color = "${d.nameColor}"\n${d.canvasAppearance ? 'define gui.main_menu_background = "galwriter-ui/canvas.png"\ndefine gui.game_menu_background = "galwriter-ui/canvas.png"\n' : ''}`;

        if (d.panelAppearance)
          content = content.replace(
            `background Solid("${toHex8(d.panelColor, d.panelAlpha)}")`,
            'background "galwriter-ui/dialogue.png"',
          );
        if (d.choiceAppearance)
          content = content
            .replace(
              `background Solid("${d.accentColor}")`,
              'background Frame("galwriter-ui/choices.png", 16, 16)',
            )
            .replace(
              `hover_background Solid("${d.accentColor}cc")`,
              'hover_background Frame("galwriter-ui/choices.png", 16, 16)',
            );
        content = content
          .replace(
            'screen say(who, what):',
            `screen say(who, what):\n    zorder ${d.layerOrder?.dialogue ?? 1}`,
          )
          .replace(
            'screen choice(items):',
            `screen choice(items):\n    zorder ${d.layerOrder?.choices ?? 2}`,
          );
      }
      if (file.path === 'game/script.rpy' && d.canvasAppearance)
        content = content.replace(
          `scene expression Solid("${d.background}")`,
          'scene expression "galwriter-ui/canvas.png"',
        );
    }
    if (target === 'tyrano' && file.path === 'data/scenario/first.ks') {
      if (d.canvasAppearance)
        content = '[bg storage="galwriter-ui/canvas.png" time="0"]\n' + content;
      if (d.choiceAppearance)
        content =
          '[iscript]\nvar gwSkin = document.createElement("style");\ngwSkin.textContent = ".glink_button { background-image: url(./data/image/galwriter-ui/choices.png) !important; background-size: 100% 100% !important; background-color: transparent !important; border: 0 !important; }";\ndocument.head.appendChild(gwSkin);\n[endscript]\n' +
          content;

      if (d.panelAppearance)
        content = content.replace(
          '[position layer="message0"',
          '[position frame="galwriter-ui/dialogue.png" layer="message0"',
        );
    }
    return { ...file, content };
  });
}
