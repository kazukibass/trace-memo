# Trace Memo

現在のメモだけでなく、関連するデータと作業の経過を時間軸で追う個人用ワークスペース。

## Stack

- React + Vite
- Cloudflare Workers + Hono
- Cloudflare D1
- TypeScript + Zod + JSON Schema

## Data axes

1. **Content** — 現在のプロジェクトとメモ
2. **Relations** — 参照、派生、対応関係
3. **Time** — RevisionとActivity Event

現在値は `notes`、本文の版は `note_revisions`、作業経過は `activity_events`、
ツールをまたぐ関係は `entity_relations` に分離する。

## Local development

```bash
npm install
npm run db:migrate:local
npm run dev
```

## Checks

```bash
npm run check
npm test
npm run build
```

## First deployment

```bash
npx wrangler login
npx wrangler d1 create trace-memo-db
```

返されたD1 database IDを `wrangler.jsonc` に設定し、次を実行する。

```bash
npm run db:migrate:remote
npm run deploy
```

本アプリは個人用のため、公開後にCloudflare AccessでWorker全体を保護する。
アプリ内に独自のパスワード認証を重複実装しない。

## Schema

共通外枠は `schemas/envelope.v0.schema.json`、メモ固有のpayloadは
`schemas/payloads/memo-note.v0.schema.json` を正本とする。

### Import ID policy

インポート時は、正常かつ一意な既存IDを維持する。全件を一律に再採番しない。

- IDがない場合はUUIDv7を自動採番する。
- IDの形式が不正な場合はUUIDv7へ自動再採番する。
- 同一インポート内でIDが重複した場合は最初のレコードのIDを維持し、後続レコードを自動再採番する。
- 保存済みデータとIDが衝突した場合、内容が同一なら同一データとして扱い、内容が異なる場合はインポート対象を自動再採番する。
- 再採番した場合は、旧ID、新ID、再採番理由をインポート結果へ記録する。
- 元ツール内のIDを保持する必要がある場合は `origin.localId` に保存する。
