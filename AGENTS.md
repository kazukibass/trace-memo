# Repository rules

- `main`へ直接pushしない。branch、check、PR、reviewの順で変更する。
- D1の破壊的Migrationは避け、既存データを保持する段階的Migrationを使う。
- `notes`は現在値、`note_revisions`は保存時点、`activity_events`は出来事として責務を混ぜない。
- 共通化の都合でツール固有データを削らない。共通外枠と種類別payloadを分離する。
- 元データを変換するときは上書きせず、派生データとして記録する。
- CloudflareのID、秘密情報、`.dev.vars`をコミットしない。
