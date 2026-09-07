import { defaultAssetCopies } from '../../assets/assetManifest';
import type { GalWriterIr } from '../../ir/irTypes';
import { stableHash } from '../../model';
import type { RenpyFile } from '../../types';
import type { TargetBuild } from '../targetTypes';
import { buildManifest, capability, reportFile, targetDiagnostics } from '../targetUtils';
import { godotRuntime } from './godotRuntime';
import type { GodotIr } from './normalizeGodotProject';

// Retain the persisted target id; the exported game is native Godot, with no plugins.
export const generateDialogicTarget = (ir: GalWriterIr): TargetBuild => {
  const capabilities = [
    capability('flow', 'Core story flow', 'full', 'Native Godot dialogue, choices, conditions, variables and save/load.'),
    capability('characters', 'Characters and portraits', 'full', 'Portraits, position, scale, flip and layers are configured automatically.'),
    capability('background', 'Backgrounds', 'full', 'Background assets and framing are included.'),
    capability('media', 'Audio and video', 'degraded', 'Audio uses PCM. Video uses 24 fps JPEG frames, up to 1280 pixels wide, with synchronized audio. Original assets are retained.'),
    capability('animation', 'Complex inline animation', 'degraded', 'Entry/exit animations and inline transformations use native Godot controls; browser styling may differ.'),
  ];
  const diagnostics = targetDiagnostics(ir, 'dialogic');
  const copies = defaultAssetCopies('dialogic', ir.assets);
  const blocks = (ir as GodotIr).godot?.blocks || ir.chapters.flatMap((chapter) => chapter.blocks).map((block) => ({ ...block, stage: { background: {}, characters: [] } }));
  const data = {
    version: 1,
    title: ir.metadata.projectName,
    projectId: stableHash(`${ir.metadata.projectName}:${ir.metadata.entryNodeId}`),
    revision: stableHash(JSON.stringify({ blocks, variables: ir.variables })),
    entryId: ir.metadata.entryNodeId,
    variables: ir.variables,
    blocks,
  };
  const nodes = Object.fromEntries(blocks.map((block) => [block.nodeId, { file: 'game/story.json', label: block.label }]));
  const manifest = buildManifest('dialogic', ir, nodes, copies);
  const file = (path: string, content: string): RenpyFile => ({ path, content, generated: true });
  const files = [
    file('project.godot', [
      '; Open in Godot 4.5 or newer, then press F5.', 'config_version=5', '', '[application]',
      `config/name=${JSON.stringify(ir.metadata.projectName)}`,
      'run/main_scene="res://game/Main.tscn"', 'config/features=PackedStringArray("4.5", "GL Compatibility")',
      '', '[display]', 'window/size/viewport_width=1280', 'window/size/viewport_height=720',
      'window/size/window_width_override=1280', 'window/size/window_height_override=720',
      'window/stretch/mode="canvas_items"', 'window/stretch/aspect="keep"',
      '', '[rendering]', 'renderer/rendering_method="gl_compatibility"',
      'renderer/rendering_method.mobile="gl_compatibility"', '',
    ].join('\n')),
    file('game/Main.tscn', '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://game/GalWriter.gd" id="1"]\n\n[node name="GalWriter" type="Control"]\nlayout_mode=3\nanchors_preset=15\nanchor_right=1.0\nanchor_bottom=1.0\ngrow_horizontal=2\ngrow_vertical=2\nscript=ExtResource("1")\n'),
    file('game/GalWriter.gd', godotRuntime),
    file('game/story.json', `${JSON.stringify(data, null, 2)}\n`),
    file('game/media.json', '{}\n'), // Populated with decoded assets during ZIP creation.
    file('export_presets.cfg', String.raw`[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter="*.json,*.gwimage,*.gwpcm,*.gwframe"
exclude_filter="galwriter_project.ir.json,galwriter_manifest.json,assets/images/*,assets/audio/*,assets/movies/*"
export_path="Game.exe"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=1

[preset.0.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=0
binary_format/embed_pck=true
binary_format/architecture="x86_64"
texture_format/bptc=true
texture_format/s3tc=true
texture_format/etc2=false
texture_format/etc2_astc=false
codesign/enable=false
application/modify_resources=false
`),
    file('galwriter_manifest.json', `${JSON.stringify(manifest, null, 2)}\n`),
    reportFile('dialogic', ir, diagnostics, capabilities),
    file('README.md', `# ${ir.metadata.projectName.replace(/[\r\n]/g, ' ')} — Godot 游戏工程\n\n## 打开并游玩\n\n1. 完整解压 ZIP，保留所有目录。\n2. 使用 Godot 4.5 或更新的标准版，在项目管理器点击“导入”，选择 project.godot。\n3. 等待首次资源扫描结束，按 F5（运行项目），点击“开始游戏”。\n\n工程自带主场景、剧情运行脚本和播放资源，无需安装 Dialogic，也无需编辑代码。必须保留整个工程目录，不能仅复制 project.godot。\n\n## 游戏操作\n\n点击文字、空格或回车推进对白；首次点击显示整段文字，再次点击进入下一段。点击选项决定分支。工具栏提供存档、读档、自动播放、历史、音量、全屏和返回标题。F11 切换全屏。存档位于 Godot 的 user:// 目录。\n\n## 从 Godot 导出 Windows 游戏\n\n1. 首次使用，在“编辑器 → 管理导出模板”中安装与当前 Godot 版本对应的官方导出模板。\n2. 打开“项目 → 导出”，选择已配置好的 Windows Desktop。\n3. 点击“导出项目”，取消“使用调试”并选择输出位置。\n4. 导出的 Game.exe 已内嵌游戏资源，玩家无需安装 Godot。\n\nWindows EXE 是可直接运行的游戏发行文件，不是 MSI/安装向导。Android APK 等平台需要在 Godot 中安装对应工具链。\n\n## 工程内容\n\n- game/Main.tscn：已设定的主场景。\n- game/GalWriter.gd：原生游戏运行脚本。\n- game/story.json：剧情、分支、变量及演出。\n- game/media.json 与 assets/godot/：离线播放资源。\n- assets/ 其他子目录：保留的原始素材。\n\n图片转换为 PNG，音频转换为 PCM。视频转换为每秒 24 帧、最大宽度 1280 的 JPEG 帧序列及同步音轨，以便原生 Godot 无插件播放 MP4/WebM 来源，因此体积可能增加。动态 GIF 当前按静态图片导出。界面为原生 Godot 默认游戏界面，复杂浏览器视觉效果可能与编辑器略有差别。\n`),
  ];
  return { target: 'dialogic', files, manifest, diagnostics, capabilities, assetCopies: copies };
};
