# P1: 本番運用とコード分割

## Problem

現状のアプリは PPTX 生成コアとしては成立しているが、本番サービスとして継続運用するには artifact lifecycle、request limit、rate / quota、監査、ドキュメント整合が不足している。また、`mapper/service.py` と `output/service.py` は機能追加に伴って肥大化しており、このまま認証、upload onboarding、visual validation を追加するとテスタビリティが落ちる。

本番導入前に、運用面の重要機能と module 分割を整え、スパゲッティ化を避ける必要がある。

## Evidence

- `security-code-docs.md` は、artifact lifecycle として startup cleanup、background cleanup、manual revoke、audit log、download count、owner metadata の追加を推奨している。
- `security-code-docs.md` は、`MAX_REQUEST_BYTES` が `Content-Length` 依存ではなく実 body stream で強制されるべきと指摘している。
- `security-code-docs.md` は、rate limit / quota / concurrency limit を user / tenant 単位で追加する必要を挙げている。
- `security-code-docs.md` は、`mapper/service.py` と `output/service.py` の分割、`server/app.py` の public tools / operator tools 分割を推奨している。
- `security-code-docs.md` は、`AGENTS.md` に古い registry / manifest 記述が残り、`APP_SPEC.md` と現行実装にずれがあると評価している。

## Scope

- artifact cleanup、manual revoke、audit log、download count を追加する。
- request body size を実 body stream で強制する。
- user / tenant 単位の rate limit、quota、concurrency limit を設計する。
- public MCP tools と operator MCP tools の登録を分ける。
- rendering、mapping、artifact、server tool registration を module 分割する。
- `APP_SPEC.md`、`AGENTS.md`、README、template docs を現行仕様に揃える。

対象外:

- 大規模な管理画面。
- 細かいコスト配賦や billing。
- すべてのメトリクス基盤の作り込み。

## Acceptance Criteria

- expired artifact が定期的に cleanup される。
- artifact を手動 revoke でき、revoke 後は download できない。
- artifact download の audit event が owner、tenant、artifact id、結果、時刻を含んで記録される。
- request size limit が `Content-Length` なし、または偽装された request でも有効である。
- user / tenant 単位の rate limit、quota、concurrency limit の方針が仕様化され、主要経路で適用されている。
- public tools と operator tools が別 module で登録され、公開範囲をテストできる。
- `output/service.py` が style policy、text/list writer、table/chart writer、icon writer、render orchestration に分割されている。
- `mapper/service.py` が inspection、AI contract validation、proposal / finalization、manifest validation に分割されている。
- `AGENTS.md` と `APP_SPEC.md` の不整合が解消されている。

## Suggested Implementation

- artifact store に lifecycle API を追加し、cleanup / revoke / download audit を分離する。
- request body size middleware を stream read 時に上限判定する方式へ変更する。
- rate / quota / concurrency は認証 issue の principal / tenant と連動させる。
- `server/app.py` から MCP tool 定義を `public_tools` と `operator_tools` に移し、`ENABLE_OPERATOR_TOOLS` の効果を明示的にテストする。
- `output/service.py` は orchestration を薄くし、slot kind ごとの writer と style policy を小さな module に分ける。
- `mapper/service.py` は検査、strict `AI_*` contract validation、manifest generation、manifest validation の責務を分ける。
- ドキュメント更新は実装と同じ change set で行い、古い companion manifest 前提や bad template skip 前提の記述を削除する。

## Tests

- Unit: expired artifact cleanup が期限切れだけを削除する。
- Unit: revoked artifact が download 不可になる。
- Unit: audit log が success / forbidden / expired / revoked を記録する。
- Integration: oversized request が `Content-Length` に依存せず拒否される。
- Integration: rate / quota / concurrency limit が user / tenant 単位で効く。
- Unit: operator tools disabled 時に custom / operator tool が登録されない。
- Unit: public tools と operator tools の registry が分離されている。
- Regression: module 分割後も render flow、template validation、MCP endpoint tests が通る。
