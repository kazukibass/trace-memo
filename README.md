# Trace Memo

現在のメモだけでなく、関連するデータと作業の経過を時間軸で追う個人用ワークスペース。

## Delivery strategy: static first

Trace Memoの本体は、静的ページだけで使えるローカルファーストのメモアプリとする。
React/TypeScriptをViteでHTML・CSS・JavaScriptへビルドし、既定の保存先にはブラウザの
IndexedDBを使う。常時稼働するAPIやD1がなくても、作成・編集・履歴・時間軸・JSON出力を
利用できることを最初の完成条件とする。

Cloudflare WorkersとD1は削除せず、端末間同期、バックアップ、認証、共有など、静的ページ
だけでは担えない機能を後から補う層として扱う。UIは保存先を直接呼ばず`MemoRepository`
だけに依存し、将来の同期追加で画面を作り直さない。

詳しい境界と移行規則は[`docs/architecture/static-first.md`](docs/architecture/static-first.md)を参照。

## Stack

- React + Vite
- IndexedDB（既定のローカル保存）
- Cloudflare Workers + Hono（将来の動的補助）
- Cloudflare D1（将来の同期先）
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
npm run dev
```

## Checks

```bash
npm run check
npm test
npm run build
```

## Static deployment

`npm run build`の成果物`dist/`はGitHub Pagesなどの静的ホスティングへ配置できる。

## Optional dynamic deployment

```bash
npx wrangler login
npx wrangler d1 create trace-memo-db
```

返されたD1 database IDを `wrangler.jsonc` に設定し、次を実行する。

```bash
npm run db:migrate:remote
npm run deploy:worker
```

本アプリは個人用のため、公開後にCloudflare AccessでWorker全体を保護する。
アプリ内に独自のパスワード認証を重複実装しない。

## Schema

共通外枠は `schemas/envelope.v0.schema.json`、メモ固有のpayloadは
`schemas/payloads/memo-note.v0.schema.json` を正本とする。

### メモの構造化とグループJSON

メモの本文を1行ずつ書いて「構造化」に切り替えると、各行を表として編集できる。
行間の「ここで区切る」「区切りを解除」で空行の境界を追加・解除し、グループを作る。
モード切替だけでは本文を変更せず、区切り操作や項目編集は明示的に行う。
グループは空行として本文に保存されるため、現在の保存形式と変更履歴を維持する。

「JSONプレビュー・書き出し」では、グループ化した内容を次の普通のJSONとしてコピー・ダウンロードできる。

```json
{
  "title": "買い物メモ",
  "groups": [
    ["だいこん", "にんじん", "じゃがいも"],
    ["鉛筆", "消しゴム"],
    ["シャンプー", "リンス"]
  ]
}
```

これは本文の派生出力で、既存の履歴JSON・ワークスペースバックアップ・共通envelopeとは別形式。
既定の保存先は引き続きこの端末のIndexedDBであり、端末間同期は行わない。

### 表計算モード

「表計算」に切り替えるだけでは本文は変化しない。新規の空メモでは「表を作成」、
既存の本文では「本文を表に変換」を明示的に選ぶと、空行を含む各行を1列に取り込む。
列名・セルの編集、行・列の追加・削除に対応する。最後の1列は削除できず、
行は0行にもできる。スマートフォンでは表を横にスクロールできる。

表はメモ本文の中に識別子とMarkdown表の形式で格納する。具体的には1行目が
`<!-- trace-memo-table:v1 -->`、続いて列名の行、区切り行、各データ行となる。
区切りのパイプ・バックスラッシュ・改行はセル内でエスケープするため、空セルや空白も保持できる。
新しいDBや保存形式の移行は不要。既存のメモ本文・履歴・バックアップに互換性を保ち、
「保存する」を押すまでは既存の保存済みメモを変更しない。普通のメモ／構造化モードは引き続き利用できる。

表計算のJSONは列名をキーとした行オブジェクトの配列になる。セルは常に文字列で、
列名が空欄または重複している場合、データを失わないようJSON書き出しを止める。
この書き出しはTrace Memoのバックアップ・共通envelopeとは別の、本文から派生したJSONである。

例: `{"title":"買い物","rows":[{"品名":"だいこん","個数":"1"},{"品名":"にんじん","個数":""}]}`

### Kanpeへの台本JSON出力

表計算モードで時間列と本文列を用意する（空のメモなら「Kanpe台本テンプレート」も利用できる）。
「Kanpe（発表台本）へ書き出し」で列を選択すると、Kanpe既存の読み込み形式
`{ "title": "発表", "cues": [{"at":0,"text":"01 開始"}] }` のJSONをコピー・ダウンロードできる。
Kanpeホームの「読み込み」へ貼り付けるかファイルを選択する。
時間は `0:00`、`1分30秒`、`90秒` 等を秒数へ変換する。数字のみはKanpeの既存取り込み規則に合わせて分として扱う。
時間の重複・降順、不正時間、本文欠落、重複列名は出力前に拒否する。
元メモや他の列は上書きせず派生出力する。共通envelopeとは別の既存Kanpe形式へのアダプター。

### Import ID policy

インポート時は、正常かつ一意な既存IDを維持する。全件を一律に再採番しない。

- IDがない場合はUUIDv7を自動採番する。
- IDの形式が不正な場合はUUIDv7へ自動再採番する。
- 同一インポート内でIDが重複した場合は最初のレコードのIDを維持し、後続レコードを自動再採番する。
- 保存済みデータとIDが衝突した場合、内容が同一なら同一データとして扱い、内容が異なる場合はインポート対象を自動再採番する。
- 再採番した場合は、旧ID、新ID、再採番理由をインポート結果へ記録する。
- 元ツール内のIDを保持する必要がある場合は `origin.localId` に保存する。
