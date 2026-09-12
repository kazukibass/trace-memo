# Static-first architecture

## Decision

Trace Memoは静的ページを製品の中心に置く。ブラウザ内で完結する機能を先に稼働させ、
Workers/D1は静的ページに不足する能力だけを後から補う。

| 層 | 初期版 | 後から追加する補助 |
| --- | --- | --- |
| UI | React + TypeScript | 変更しない |
| データ窓口 | `MemoRepository` | 同期ポリシーを追加 |
| 既定保存 | IndexedDB | ローカルキャッシュとして継続 |
| リモート | なし | Workers API + D1 |
| 公開 | GitHub Pages等 | 必要ならCloudflare Access |

## Boundary

UIはIndexedDB、`localStorage`、HTTP API、D1を直接扱わない。すべての読取・変更・出力は
`MemoRepository`を通す。初期版は`IndexedDbMemoRepository`を注入する。将来は同じ契約に
同期機能を持つRepositoryを追加する。

`notes`は現在値、`note_revisions`は保存時点、`activity_events`は出来事という責務を、
ローカル保存でもD1でも維持する。

## Legacy migration

同じoriginに旧ブラウザデータがある場合、初回起動時に次の順序で移行する。

1. IndexedDBの新保存先を確認する。既存データがあれば移行しない。
2. 既知の旧`localStorage`キーを順番に確認する。
3. 元データを変更せず、現在のWorkspace形式へ変換する。
4. 新しいIDを発行し、Revision 1と移行Activity Eventを生成する。
5. IndexedDBへコピーする。
6. IndexedDBから読み戻し、コピー内容が一致することを確認する。
7. 元JSONを含む移行レシートをIndexedDBへ保存する。
8. 検証とレシート保存に成功した場合だけ、旧キーを削除する。

途中で失敗した場合は旧データを削除しない。旧アプリと新アプリのoriginが異なる場合、
ブラウザの同一オリジン制約により直接参照できないため、旧アプリからJSONを書き出して
新アプリへ読み込む別の移行導線を用意する。

## Dynamic assistance roadmap

Workers/D1は以下が必要になった時点で有効化する。

- PCとスマートフォン間の同期
- 端末紛失に備えたリモートバックアップ
- 認証された共有
- 競合検出と同期履歴

D1を唯一の正本へ急に切り替えない。IndexedDBを先に維持し、アップロード、照合、同期済み
マーク、競合処理を段階的に追加する。破壊的Migrationと暗黙の上書きは行わない。
