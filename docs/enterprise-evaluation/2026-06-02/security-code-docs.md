# エンタープライズ評価メモ: セキュリティ・コード品質・運用準備度

作成日: 2026-06-02

## 要約

現状のアプリは、サーバー管理テンプレートと `AI_*` Selection Pane 名による strict mapping で PPTX を生成するコア機能としては成立している。一方で、エンタープライズ本番サービスとして public に出すには、認証・認可と artifact 所有者制御が不足している。

特に `/artifacts/{token}` は UUID token と TTL による短期 secret URL 方式であり、発行者 user / tenant に紐づく認可はない。したがって「発行したユーザーだけがダウンロードできる」要件は未達。`/mcp` も組み込み認証なしのため、本番では reverse proxy / IdP / Access gateway で必ず保護する必要がある。

## 根拠

- `APP_SPEC.md:254-259` では `/health`, `/artifacts/{token}`, `/mcp` の認可がすべて「なし」。
- `APP_SPEC.md:398-409` は「現在は組み込み認証なし」「ユーザー単位の認可は行わない」と明記している。
- `src/pptx_yaml_engine/server/artifacts.py:14-21` の `Artifact` は owner / tenant / principal を持たない。
- `src/pptx_yaml_engine/server/artifacts.py:50-62` は UUID token を発行し、`entries[token]` に保存するだけ。
- `src/pptx_yaml_engine/server/app.py:356-371` は token の存在と TTL だけで artifact を返す。
- `src/pptx_yaml_engine/server/app.py:245-349` では operator tools が `ENABLE_OPERATOR_TOOLS` 配下にあり、通常公開 tool を絞る設計は良い。
- `src/pptx_yaml_engine/server/app.py:317-346` の `render_presentation_custom` は caller supplied `template_b64` を処理するため、public user upload 経路としては危険。
- `compose.yaml:24-34` は read-only filesystem / tmpfs / no-new-privileges / cap drop などの container hardening があり、運用面の土台はある。
- `AGENTS.md:31-38` には companion manifest 必須や bad template skip など、現行 `APP_SPEC.md` / 実装とずれた古い記述が残っている。

## Issue 候補

### P0

- Artifact download を発行者限定にする。認証済み user / tenant / principal を artifact metadata に保存し、`GET /artifacts/{token}` で owner / tenant を再認可する。
- Public `/mcp` と `/artifacts/{token}` を認証必須にする。Cloudflare Access、Entra ID、API Gateway、reverse proxy などのいずれかを本番必須境界として仕様化する。

### P1

- User template upload を正式要件にするか決める。採用する場合、`render_presentation_custom` の流用ではなく、認証済み upload、tenant template registry、strict validation、quota、scan、approval/rejection report を設計する。
- `MAX_REQUEST_BYTES` を `Content-Length` 依存ではなく実 body stream で強制する。
- Artifact lifecycle を強化する。startup cleanup、background cleanup、manual revoke、audit log、download count、owner metadata を追加する。
- Quick Tunnel profile を本番導線から外すか、local/dev-only として明確に隔離する。
- Rate limit / quota / concurrency limit を user / tenant 単位で追加する。

### P2

- `AGENTS.md` の古い registry / manifest 記述を `APP_SPEC.md` と現行コードに合わせる。
- `server/app.py` の MCP tool 登録を public tools と operator tools に分割する。
- `output/service.py` を style、text/list writer、table/chart writer、icon writer、render orchestration に分ける。
- `mapper/service.py` を inspection、AI contract validation、proposal/finalization、manifest validation に分ける。
- Artifact endpoint の 200 / 404 / TTL / Cache-Control / delete に関する unit test を追加する。
