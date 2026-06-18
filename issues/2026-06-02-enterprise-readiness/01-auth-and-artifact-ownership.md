# P0: 認証と artifact 所有者制御

## Problem

現状は `/mcp` と `/artifacts/{token}` に組み込み認証がなく、artifact download は UUID token と TTL による短期 secret URL 方式である。推測困難性はあるが、発行者 user / tenant に紐づく認可はない。

ユーザー要件では「発行されたプレゼンテーションスライドは、そのプレゼンテーションを発行したユーザーのみがアクセスできること」が必須であるため、現状のままでは本番公開できない。

## Evidence

- `APP_SPEC.md` は現在の認証方式を「組み込み認証なし」としている。
- `APP_SPEC.md` は `/health`、`/artifacts/{token}`、`/mcp` の認可を「なし」としている。
- `security-code-docs.md` は、`Artifact` が owner / tenant / principal を持たず、token の存在と TTL だけで download できると評価している。
- `design-quality.md` でも、artifact download は UUID token + TTL の一時 URL であり、user / tenant 所有権検証はないと評価している。

## Scope

- 本番公開時の認証境界を仕様化する。
- 認証済み principal / tenant を render request に結び付ける。
- artifact metadata に owner / tenant / expires_at / revoke state を保持する。
- `/artifacts/{token}` で発行者本人または同一 tenant など、決めた ownership rule を再認可する。
- `/mcp` を public に出す場合は、IdP、reverse proxy、Cloudflare Access、Entra ID、API Gateway などの認証境界を必須にする。
- operator tools は public user から呼べない状態を維持する。

対象外:

- 複雑な billing、細かい role hierarchy、部門別共有権限。
- 本格的なファイル管理 UI。

## Acceptance Criteria

- 認証なしで `/mcp` の protected tool を呼び出せない。
- 認証なしで `/artifacts/{token}` から PPTX を取得できない。ただし明示的に採用した signed download URL 方式では、署名、期限、scope、改ざん検知が検証される。
- User A が生成した artifact を User B が download できない。
- render 時に artifact owner / tenant / expires_at が保存される。
- artifact download は owner / tenant、TTL、revoke state、Cache-Control を検証する。
- 認証境界、trusted proxy header、local dev での fake principal の扱いが `APP_SPEC.md` と運用ドキュメントに反映されている。
- P0 の security tests が追加され、認可漏れを検出できる。

## Suggested Implementation

- app-level auth middleware を追加し、検証済みの JWT または trusted proxy header から `principal_id` と `tenant_id` を作る。
- trusted proxy header を使う場合は、直接クライアントが同じ header を偽装できないネットワーク境界を仕様化する。
- `render_presentation` の request context から principal を取得し、artifact store に owner metadata を保存する。
- artifact token は引き続き推測困難にしつつ、token 単体を認可の根拠にしない。
- 認証基盤をアプリに内蔵しない方針を採る場合でも、download URL には HMAC 署名、期限、artifact id、owner scope を含め、検証済み principal と照合する。
- `/health` は必要に応じて unauthenticated のまま維持し、その他の本番 endpoint は protected にする。
- operator tools は認証済み admin / operator scope がある場合だけ公開する。

## Tests

- Unit: auth middleware が verified principal を request state に設定する。
- Unit: artifact store が owner / tenant / expires_at / revoked を保存する。
- Unit: expired / revoked / owner mismatch artifact が拒否される。
- Integration: User A が生成した artifact を User A は取得でき、User B は 403 になる。
- Integration: unauthenticated `/mcp` protected call と `/artifacts/{token}` download が拒否される。
- Integration: trusted proxy header がない direct request では principal が作られない。
- Regression: operator tools が public user に公開されない。
