# redmine-mcp-server

Redmine を運用保守で使っているチーム向けの MCP サーバー。Claude Code から Redmine のチケット・プロジェクトを参照し、チケットのステータス・担当者・進捗率の更新やコメント追加を行えます。`docker run -i --rm` で起動して stdio 経由で接続します。

読み取り中心の設計で、書き込みはチケット更新（ステータス・担当者・進捗率・コメント）のみ。チケット作成 / 削除 / 優先度変更 / wiki 編集は意図的に実装していません。

公開 Docker イメージ（`ikutani41/redmine-mcp-server`）を Docker Hub に置いてあるので、clone やビルドなしで使えます。カスタマイズしたい場合のみ後述の「自分でビルドして使いたい場合」を参照してください。

## ツール

- `get_redmine_issue` — チケットを 1 件取得
- `list_redmine_issues` — チケット一覧（プロジェクトや担当者などで絞り込み）
- `update_redmine_issue` — チケット更新（ステータス・担当者・進捗率・コメント）
- `list_redmine_projects` — プロジェクト一覧
- `get_redmine_project` — プロジェクトを 1 件取得
- `list_redmine_members` — プロジェクトのメンバー一覧
- `list_redmine_statuses` — ステータス一覧

詳細な引数は `tools/list` で確認してください。

## 環境変数

| 名前 | 必須 | 用途 |
| --- | --- | --- |
| `REDMINE_URL` | ✓ | Redmine の base URL（例: `https://redmine.example.com`） |
| `REDMINE_API_KEY` | ✓ | Redmine の API キー（個人設定 → API アクセスキー） |

API キーは `X-Redmine-API-Key` ヘッダでのみ送信されます。stdout・ツール応答・stderr ログのいずれにも出力されません。

## Claude Code への登録

ユーザースコープ（`~/.claude.json`、自分のマシン全体で利用可能）で登録します。

### 1. エントリを作る

API キー部分は仮値のままで OK。先にエントリだけ作っておきます。`--pull always` を付けているので、起動のたびに Docker Hub の最新イメージを取得します。

```sh
claude mcp add redmine \
  --scope user \
  --transport stdio \
  --env REDMINE_URL=https://xxx.cloud.redmine.jp \
  --env REDMINE_API_KEY=xxxxx \
  -- docker run -i --rm --pull always \
    -e REDMINE_URL \
    -e REDMINE_API_KEY \
    ikutani41/redmine-mcp-server
```

### 2. API キーを書き込む

`~/.claude.json` をエディタで開き、`mcpServers.redmine.env` の `REDMINE_URL` と `REDMINE_API_KEY` を自分の値に書き換えてください。`REDMINE_API_KEY` は Redmine の「個人設定 → API アクセスキー」で取得できます。

### 3. 疎通確認

Claude Code を再起動した後、`/mcp` を実行して `redmine` が `connected` になっていることを確認してください。続けて Claude に「`list_redmine_projects` を limit 1 で呼んで」と頼み、プロジェクトが 1 件返ってくれば疎通 OK です。失敗時は次を確認：

- `Redmine authentication failed.` → API キーが正しく書き換えられているか
- `Redmine request failed (network error).` → `REDMINE_URL` の到達性、Docker からの外向き通信

## セキュリティ方針

- API キーは `REDMINE_API_KEY` 環境変数からのみ読み取り。Docker イメージに焼き込まないこと。
- 書き込みはチケット更新（ステータス・担当者・進捗率・コメント）のみ。チケット作成・削除は実装していません。
- MCP クライアントへ返すエラーは要約済み。生 URL・ヘッダ・API キーはエラーメッセージに含まれません。

---

## 開発者向け

### 技術スタック

- TypeScript / Node.js 22
- `@modelcontextprotocol/sdk` v1.x（stdio transport）
- `zod` による入力スキーマ
- `fetch`（追加 HTTP ライブラリなし）

### ローカル開発

```sh
npm install
npm run dev          # tsx watch
# または
npm run build && npm start
```

### 自分でビルドして使いたい場合

```sh
docker build -t redmine-mcp-server .
```

`claude mcp add` のコマンド末尾の `ikutani41/redmine-mcp-server` を `redmine-mcp-server` に差し替えれば、自前ビルドのイメージが使われます。

### スモークテスト（Redmine 不要）

```sh
( printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; \
  sleep 1 ) | \
REDMINE_URL=http://example.test REDMINE_API_KEY=stub node dist/server.js
```

stdout に 7 個のツールが返れば OK。
