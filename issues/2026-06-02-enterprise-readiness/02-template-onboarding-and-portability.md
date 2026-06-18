# P1: テンプレート onboarding と可搬性

## Problem

Selection Pane の `AI_*` 名を使う方式により、shape の役割判定は deterministic になっている。一方で、現状は「ルールさえ守れば、どのようなテンプレートでもユーザーが自由に upload して即利用できる」とは言えない。

通常フローは server-managed template 前提であり、テンプレートは `TEMPLATE_DIR` に配置され、起動時に strict manifest が生成される。さらに全 semantic layout、正しい PowerPoint layout 名、placeholder-only、slot type 互換性が必要である。ユーザー持ち込み template を product feature として提供するには、onboarding と validation の設計が必要である。

## Evidence

- `APP_SPEC.md` は通常フローでユーザーアップロードによるテンプレート選択を前提にしていない。
- `APP_SPEC.md` は mapping を PowerPoint layout 名 + `AI_*` placeholder 名だけで生成し、non-placeholder shape を通常 render 対象にしないと定義している。
- `template-portability.md` は、現時点で使えるテンプレートを「全 semantic layout」「許可 layout 名」「PowerPoint placeholder」「required `AI_*` 名」「type 互換性」を満たすものに限定している。
- `template-portability.md` は、通常 text box / 図形に `AI_*` 名を付けただけのテンプレート、一部 layout だけの企業テンプレート、実行時 user upload template は現時点で使えない、または使いにくいと評価している。

## Scope

- server-managed template と end-user upload template の product contract を分けて定義する。
- template author が満たすべき `AI_*` placeholder contract を明文化する。
- template onboarding 用の検査レポートを用意する。
- full semantic layout 必須を継続するか、partial template support を許容するかを決める。
- user upload を正式機能にする場合は、tenant template registry、strict validation、quota、scan、preview、approval / rejection report を設計する。

対象外:

- 任意 shape への best-effort 差し込み。
- geometry 推測や legacy fallback の復活。
- PowerPoint の全デザインパターンを自動補正する機能。

## Acceptance Criteria

- 「使えるテンプレート」と「使えないテンプレート」の条件が `APP_SPEC.md` と authoring docs に明記されている。
- layout 別の required / optional `AI_*` name 一覧、推奨 placeholder type、容量目安がドキュメント化されている。
- template inspection / validation の結果が、template author に理解できる failure report として返る。
- user upload を採用する場合、upload された template は認証済み user / tenant に紐づき、strict validation を通過したものだけが render に使える。
- user upload を採用しない場合、server-managed template の登録手順と運用責任が明確になっている。
- partial template support を採用するかどうかが決まり、`list_templates` と deck validation の挙動が仕様と一致している。

## Suggested Implementation

- `AI_*` contract を layout 別 checklist として出力できる tool または doc generator を用意する。
- `inspect_template -> validate_manifest` の結果を、missing / unknown / duplicated / non-placeholder / incompatible / layout missing ごとに整理した onboarding report にする。
- end-user upload を提供する場合は、`render_presentation_custom` を public upload 経路として流用せず、認証済み upload、tenant-scoped template registry、validation、preview、quota を持つ別フローにする。
- full layout 必須を維持する場合は、その理由を「deck の任意 layout を安全に生成するため」として明記する。
- partial support を採用する場合は、template が対応する semantic layout だけを `list_templates` に出し、未対応 layout を含む deck を validation で拒否する。
- `SEMANTIC_DECK_SPEC.md`、tool docstring、`LAYOUT_SPECS`、default manifest の layout 数と名称を一致させる。

## Tests

- Unit: valid template が `AI_*` contract を通過する。
- Unit: missing / unknown / duplicated / non-placeholder / incompatible placeholder が分かりやすい issue として返る。
- Integration: server-managed template が起動時に strict validation される。
- Integration: user upload を採用する場合、invalid template は registry に登録されない。
- Integration: partial support を採用する場合、未対応 layout を含む deck が render 前に拒否される。
- Docs check: layout 数、layout 名、`AI_*` name 一覧が `LAYOUT_SPECS` と矛盾しない。
