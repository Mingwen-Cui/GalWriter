# 樱花校园模板（四页面）

`template.json` 是该模板唯一的配置入口。所有图片使用相对路径，因此导出模板时会一并打包。

```text
page1/
├─ template.json
└─ pages/
   ├─ home/                 # 主页面
   │  ├─ background.png
   │  ├─ character.png
   │  ├─ title-ornament.png
   │  └─ buttons/
   │     ├─ continue.png
   │     ├─ new-game.png
   │     ├─ settings.png
   │     └─ letter.png
   ├─ archive/background.png  # 存档页面背景
   ├─ settings/background.png # 设置页面背景
   └─ dialogue/background.png # 对话页面与场景背景
```

替换照片时请保留文件名和相对路径；若要使用新名称，请同步修改 `template.json` 对应页面的 `*ImageUrl` 字段。
