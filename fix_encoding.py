#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 读取文件
with open('src/components/StoryEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换乱码和修复语法错误
replacements = [
    # 第43行：使用懒加载减少首屏体
    ('// 使用懒加载减少首屏体\nconst PlayTestModal', '// 使用懒加载减少首屏体积\nconst PlayTestModal'),
    
    # 第73行：修复开始的乱码 - 注释中的数据
    ('// data: { id: \'root\', title: "开', '// data: { id: \'root\', title: "开始'),
    ('title: "从前有座', 'title: "从前有座山'),
    
    # 第117-118行：JSDoc注释中的乱码
    ('* 获取媒体文件的原始尺\uff1f', '* 获取媒体文件的原始尺寸'),
    ('@param url 媒体 URL (data: \uff1fblob:)', '@param url 媒体 URL (data:url或blob:)'),
    
    # 第133行：修复函数结束处的错误语法
    ('resolve({ width: 400, height: 200 }); // 音频或其\uff1f    }\n    });\n};', 
     'resolve({ width: 400, height: 200 }); // 音频或其他类型\n    }\n  });\n};'),
    
    # 修复AI提供商注释
    ("// NOTE: 'gemini' 使用 Google GenAI\uff1f'deepseek'", 
     "// NOTE: 'gemini' 使用 Google GenAI接口，'deepseek'"),
    
    ("// NOTE: 思考模式仅\uff1fDeepSeek", 
     "// NOTE: 思考模式仅在 DeepSeek"),
    
    # 修复显示状态注释
    ('// 右上角显示的思考过程文字，null 表示不显\n  const [thinkingContent', 
     '// 右上角显示的思考过程文字，null 表示不显示\n  const [thinkingContent'),
    
    # 修复生成长度中的乱码
    ("const [generateLength, setGenerateLength] = useState<string>('\uff1f-3句话');",
     "const [generateLength, setGenerateLength] = useState<string>('1-3句话');"),
    
    # 修复剪贴板注释
    ('// 卡片剪贴\n  const [nodeClipboard', 
     '// 卡片剪贴板\n  const [nodeClipboard'),
    
    # 修复屏幕坐标注释
    ('// 转换为屏幕坐\uff08考虑缩放与偏', 
     '// 转换为屏幕坐标（考虑缩放与偏'),
    
    # 修复复制成功的消息
    ("'复制成功\uff01'", "'复制成功！'"),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✓ 修复 ({count}): {old[:40]}...")
    else:
        print(f"✗ 未找到: {old[:40]}...")

# 写回文件
with open('src/components/StoryEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✓ 文件已修复，共修复 {count} 处")
