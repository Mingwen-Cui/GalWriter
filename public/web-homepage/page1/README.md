# 樱花校园模板（四页面）

源模板使用一套共享图片；点击“导出模板”后，会生成一个清单和四份互相隔离的页面 JSON，所有页面共用同一套 `assets/` 图片，不会重复打包。

```text
page1/
├─ template.json             # 源预设（编辑器读取）
└─ assets/                   # 四个页面共享的图片，只保留一份
   ├─ background.png
   ├─ character.png
   ├─ title-ornament.png
   └─ buttons/
      ├─ continue.png
      ├─ new-game.png
      ├─ settings.png
      └─ letter.png
```

导出的 ZIP 结构：

```text
template.json                # 清单
pages/home.json              # 主页面
pages/archive.json           # 存档页面
pages/settings.json          # 设置页面
pages/dialogue.json          # 对话页面
assets/                      # 共用图片
```

替换照片时请保留文件名和相对路径；若要使用新名称，请同步修改对应页面 JSON 的 `*ImageUrl` 字段。
