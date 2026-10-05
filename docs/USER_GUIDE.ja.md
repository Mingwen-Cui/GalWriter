# GalWriter クイックスタート

GalWriter はビジュアルノベル、分岐ストーリー、インタラクティブなプレゼンを作るためのツールです。キャンバスで構成し、プレイテストで確認してから書き出します。

## はじめに

1. [GitHub Releases](https://github.com/Mingwen-Cui/GalWriter/releases) から Windows 版をダウンロードします。**Lite（軽量版）をおすすめします**。プリセット画像、音楽、テンプレートを必要に応じてオンライン取得します。オフラインで全リソースを使う場合は Full を選びます。
2. プロジェクトを作成し、ストーリーカードを追加して選択肢と分岐を線でつなぎます。
3. キャラクター、シーン、数値条件を追加します。AI 機能には「設定 → AI」でプロバイダーと API Key の設定が必要です。
4. Playtest で選択肢と演出を確認し、Web、動画、PPT、コードのワークスペースから書き出します。
5. プロジェクト ZIP を定期的に保存してバックアップします。

## Codex と MCP を接続

MCP は Windows デスクトップ版で利用できます。GalWriter を起動し、Assistant →「AI MCP」の接続プロンプトをローカル Codex にコピーします。接続先は `http://127.0.0.1:38941/mcp` です。接続中は GalWriter を起動したままにしてください。ブラウザー版から利用者 PC 上の MCP サーバーには接続できません。

## データとプライバシー

プロジェクトと AI Profile はローカルに保存されます。API Key はデフォルトでプロジェクト ZIP に含まれません。Lite とオンライン素材の利用にはインターネット接続が必要です。

## リンク

- [リリース](https://github.com/Mingwen-Cui/GalWriter/releases)
- [ビルド・リリースガイド](build/BUILD_GUIDE.ja.md)
- [問題を報告](https://github.com/Mingwen-Cui/GalWriter/issues)
