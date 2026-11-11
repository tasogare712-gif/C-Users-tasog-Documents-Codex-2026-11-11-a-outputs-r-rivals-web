# R-Rivals

スマートフォン縦向きに対応した、無料のブラウザカードゲームです。

- CPU対戦
- 2人対戦（1台のスマートフォンを交代で操作）
- スマートフォンでは縦向きレイアウト、狭い画面ではカードを2列で表示

## PCで起動

```powershell
npm install
npm run dev
```

## 無料でWeb公開（Render）

このプロジェクトにはRender用の `render.yaml` を入れています。

1. GitHubに新しいリポジトリを作り、このフォルダの中身をアップロードします。
2. [Render Dashboard](https://dashboard.render.com/) にサインアップしてGitHubを接続します。
3. **New → Blueprint** を選び、作ったGitHubリポジトリを指定します。
4. Blueprintの内容を確認して作成します。Renderがビルドし、`https://r-rivals.onrender.com` のようなURLを発行します。
5. デプロイが完了したら、そのURLをスマートフォンで開きます。

RenderのStatic Siteは無料で公開できます。GitHubへ変更を保存すると自動で再デプロイされます。

## 同じWi-Fiのスマートフォンで確認

```powershell
npm run dev -- --host 0.0.0.0
```

PowerShellに表示される `Network` のURLを、同じWi-Fiにつないだスマートフォンで開きます。
