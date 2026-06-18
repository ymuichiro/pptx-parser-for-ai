# Enterprise Readiness Issues

作成日: 2026-06-02

このディレクトリは、`docs/enterprise-evaluation/2026-06-02/` の評価レポートをもとに、本番導入判断に関わる改善だけを issue 化したものです。細かい edge case ではなく、エンタープライズ向けのプレゼンテーション作成サービスとして成立させるための必須論点に絞ります。

## 優先度順

1. P0: [認証と artifact 所有者制御](01-auth-and-artifact-ownership.md)
   - 発行したユーザーのみが生成 PPTX にアクセスできる状態にする。
   - `/mcp` と `/artifacts/{token}` を本番公開時に認証境界の内側へ置く。

2. P1: [テンプレート onboarding と可搬性](02-template-onboarding-and-portability.md)
   - Selection Pane の `AI_*` ルールを満たせば使える、という期待を product contract として正確に成立させる。
   - server-managed template と end-user upload template の扱いを分けて設計する。

3. P1: [default design と日本語 visual regression](03-default-design-japanese-visual-regression.md)
   - default template でも、日本語・海外向けの両方で仕事に使える品質を継続検証する。
   - 長文、CJK font、画像比率、枠線、watermark overlap を回帰検出する。

4. P1: [本番運用とコード分割](04-production-ops-and-code-modularity.md)
   - artifact lifecycle、request limit、rate/quota、監査、ドキュメント整合を整える。
   - 大きくなっている module を分割し、追加機能をテスタブルに保つ。

## 完了条件

- P0 issue が完了し、認証済み principal / tenant と artifact ownership の検証が実装されている。
- 本番公開する `/mcp` と `/artifacts/{token}` の認証境界が仕様・実装・運用ドキュメントで一致している。
- テンプレート利用方式について、server-managed template と user upload / custom template の product contract が明文化されている。
- default template の日本語・英語サンプル deck が生成でき、PowerPoint export 画像で clipping、distortion、border regression、watermark overlap を検出できる。
- 重要な運用機能と module 分割が完了し、`APP_SPEC.md`、`AGENTS.md`、README、テストが現行実装と矛盾しない。

## 推奨実施順

1. `01-auth-and-artifact-ownership.md`
   - ユーザー要件の「発行したユーザーのみアクセス」を満たさない限り、本番公開判断ができない。

2. `02-template-onboarding-and-portability.md`
   - ユーザーがどの範囲で自分のテンプレートを使えるのかを先に確定する。これにより、セキュリティ境界と validation 方式も決めやすくなる。

3. `03-default-design-japanese-visual-regression.md`
   - default output を商用利用水準に保つため、視覚品質を自動検証できる状態にする。

4. `04-production-ops-and-code-modularity.md`
   - 上記機能を入れる前後で module 分割と運用機能を整え、保守性を落とさない。
