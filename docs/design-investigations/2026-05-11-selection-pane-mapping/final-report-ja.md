# Selection Pane 命名ベース mapping に関する最終報告

**結論:** このアプリは、PowerPoint の Selection Pane 名を使う設計に寄せることで **より信頼性を高められる**。ただし初手で採るべきなのは、**`AI_*` 名を付けた placeholder を権威ソースにし、manifest/renderer の実体は当面 `idx` ベースのまま残す** 方式である。逆に、任意の非-placeholder shape を実行時に名前で探して直接書き込む方式は、現行の renderer・validation・`python-pptx` の実態と噛み合わず、最初の実装としては重すぎる（`current-mapping.md:60-64`, `current-mapping.md:78-84`, `render-and-redesign-plan.md:24-39`, `render-and-redesign-plan.md:108-137`, `render-and-redesign-plan.md:138-165`）。

本書は**設計レビュー用の提案**であり、コード実装を主張するものではない。

## 現在の実装状態

- `APP_SPEC.md` の現行契約は、manifest が semantic slot を PowerPoint placeholder `idx` に結び付け、通常レンダリングでは template 既存の placeholder / content 領域へ差し込む、というもの。実際の処理もその契約どおりで、検証は「その `idx` が存在するか」が中心であり、描画は `slide.placeholders[idx]` に対して行われる（`APP_SPEC.md:12-18`, `APP_SPEC.md:90-98`, `APP_SPEC.md:111-126`; `current-mapping.md:27-35`, `current-mapping.md:60-64`; `render-and-redesign-plan.md:24-39`）。
- `inspect_template()` は全 shape の `shape_name` を見ているが、mapping 対象として実際に使っているのは placeholder だけである。しかも binding は `slot__*` 系の名前が当たらない場合、layout alias・localized builtin 名・placeholder type・geometry による推定へ落ちる（`current-mapping.md:19-25`, `current-mapping.md:44-58`, `current-mapping.md:66-74`）。
- つまり現状は、**authoring 時の名前は補助情報、render 時の実キーは `idx`** である。ここが今回の設計論点の出発点になる（`render-and-redesign-plan.md:26-37`）。

## 提案の方向性が良い理由

- `AI_TITLE`, `AI_COL1_HEADING`, `AI_COL1_BODY` のような明示名を使えば、いまの alias / type / geometry 依存の推定をかなり減らせる。特に title/subtitle 判定、左右カラム判定、3-card の幾何推定、required slot 未解決時の confidence 低下を抑えやすい（`current-mapping.md:66-74`）。
- 既存の default template でも、`slot__...` が明示されている custom layout 側は heuristic 依存が相対的に低く、命名が効くことはすでに確認できる（`current-mapping.md:76-76`, `render-and-redesign-plan.md:90-97`）。
- したがって、**「layout/slot の意味を PowerPoint 側で明示する」** という方向は正しい。改善点は renderer 全面刷新ではなく、まず mapping と validation の曖昧さを潰すことにある（`current-mapping.md:86-93`, `render-and-redesign-plan.md:166-213`）。

## 推奨する最初の実装パス

**推奨:** Option A を先に採る。すなわち、

1. **`AI_*` 命名を placeholder に対して要求する**
2. **mapping は name-first にする**
3. **renderer は当面 `idx` のまま維持する**

これを推奨する理由は明確で、**変更量に対する determinism 改善が最も大きい**からである。現行 renderer は text/list/icon/table/chart を placeholder ネイティブ API で処理しており、ここを温存すれば `render_presentation` 系の契約を大きく崩さずに済む（`render-and-redesign-plan.md:110-137`, `render-and-redesign-plan.md:166-213`）。

実装順は次の方針がよい。

- binding 優先順位を **`AI_*` → 既存 `slot__*` / `placeholder__*` → 現行 heuristic** にする（`current-mapping.md:88-92`, `render-and-redesign-plan.md:180-186`）
- manifest の形は当面維持しつつ、意味を **`shape_name` が権威ソース、`idx` は render locator、`type` は互換性チェック** に寄せる（`render-and-redesign-plan.md:187-205`, `render-and-redesign-plan.md:252-279`）
- layout 特定と slot 特定は分けて考える。`AI_*` は slot 特定に特に効くが、layout 解決はなお `ppt_layout_name` の世界が残る（`current-mapping.md:93-93`, `render-and-redesign-plan.md:390-392`）

## 任意の非-placeholder shape 対応を初手にしない理由

- 現行 pipeline は inspection で shape 名を見ていても、binding と render は placeholder 前提で設計されている（`current-mapping.md:80-84`, `render-and-redesign-plan.md:72-89`）。
- 調査では、**layout 上の名前が生成後 slide 上で安定した名前として残らない**、**非-placeholder の装飾 shape は slide 側でそのまま bind しにくい** という runtime 上の懸念が出ている。したがって「slide 上で名前検索して直接書く」方向は drop-in replacement にならない（`render-and-redesign-plan.md:99-106`）。
- さらに table/chart/icon は現在 placeholder ネイティブ API に依存しているため、任意 shape 対応を先にやると overlay / replacement ロジックが必要になり、theme fidelity と保守性のリスクが一気に上がる（`current-mapping.md:82-84`, `render-and-redesign-plan.md:149-165`, `render-and-redesign-plan.md:386-388`）。

## 具体的な実装ポリシー

### 1. APP_SPEC 更新方針

変更を入れるなら、少なくとも以下を仕様に反映すべきである。

- **アプリ目的 / 用語 / 業務ルール**: manifest は「placeholder `idx` だけが権威」ではなく、「Selection Pane 名が権威、`idx` は内部 locator」という表現に更新する
- **テンプレート登録フロー**: strict mode では `AI_*` 名の欠落・重複・不正を起動失敗条件に加える
- **tool semantics / error model / test policy**: `inspect_template` / `propose_mapping` / `finalize_manifest` / `validate_manifest` の意味変更、新しい validation error、必要テストを明記する

対象セクションは調査ノート上でも整理済みである（`render-and-redesign-plan.md:214-228`）。

### 2. 命名スキーマ方針

- 命名は **既存 `LAYOUT_SPECS` の slot path にコンパイルできること** を最優先にする。新しい第二の slot taxonomy は作らない（`render-and-redesign-plan.md:174-179`, `render-and-redesign-plan.md:394-396`）。
- 可能なら `AI_TITLE`, `AI_SUBTITLE`, `AI_LEFT_TITLE`, `AI_LEFT_DESCRIPTION`, `AI_RIGHT_TITLE`, `AI_RIGHT_DESCRIPTION`, `AI_CARD1_ICON`, `AI_CARD1_BODY`, `AI_TABLE`, `AI_CHART`, `AI_BODY`, `AI_REFERENCES` のように、semantic slot path に近い命名を推奨する（`render-and-redesign-plan.md:174-179`）。
- どうしても `AI_COL1_HEADING` / `AI_COL1_BODY` のような UI 寄り語彙を使う場合は、**semantic layout ごとの翻訳表**を明示的に持つ。曖昧語彙のままにすると、heuristic を別名で温存するだけになる（`render-and-redesign-plan.md:136-137`, `render-and-redesign-plan.md:394-396`）。

### 3. Mapper 変更方針

- `AI_*` parser を追加し、required slot はまずそこから埋める
- `AI_*` を採用する layout では、required slot の silent heuristic fallback を避ける
- legacy template 互換のため、旧 `slot__*` と既存 heuristic は fallback として残す

この方針なら、新旧 template を共存させつつ deterministic mapping へ段階移行できる（`current-mapping.md:88-92`, `render-and-redesign-plan.md:180-205`, `render-and-redesign-plan.md:376-380`）。

### 4. Manifest validation 方針

`validate_manifest_against_inspection()` を強化し、少なくとも次を検証対象にするべきである。

1. authoritative `shape_name` が対象 layout に存在すること
2. 同名 target が 1 layout 内で一意であること
3. v1 では placeholder であること
4. slot kind と placeholder type が互換であること
5. manifest に保持した `idx` と名前解決結果が一致すること
6. strict mode では required slot が `AI_*` で揃っていること

想定エラー例も含めて、設計のたたき台は既に整理されている（`render-and-redesign-plan.md:315-345`）。

### 5. Renderer 影響方針

- v1 では `_write_text` / `_write_list` / `_write_icon` / `_write_table` / `_write_chart` を基本的に変えない
- render 時のターゲット解決は引き続き `slide.placeholders[idx]` を使う
- 変えるべきなのは renderer 本体より、**render 前 validation を name-first にすること** である

これは現行出力エンジンを温存しつつ、誤マッピングだけを減らすための方針である（`render-and-redesign-plan.md:187-209`, `render-and-redesign-plan.md:400-406`）。

### 6. テスト方針

最低限、次を追加・更新するべきである。

- mapper unit test: `AI_*` parser、AI 名が heuristic に勝つこと、欠落/重複/`shape_name`-`idx` 不一致の失敗
- template registry test: strict AI naming 不備で起動失敗すること
- integration render test: AI-named template fixture で意図した slot に入ること
- default template migration を行うなら asset test の期待値更新

整理済みの影響範囲は次を参照（`render-and-redesign-plan.md:347-375`）。

### 7. 移行方針

- **いきなり AI-only にはしない**。現行テンプレート群はまだ混在状態で、registry は incomplete mapping を起動時に fail-fast するため、即時全面切替は壊れやすい（`render-and-redesign-plan.md:376-380`）。
- まずは **legacy fallback 付きの name-first** にし、strict mode は新規テンプレートまたは移行済みテンプレートに段階適用するのが安全である（`current-mapping.md:88-92`, `render-and-redesign-plan.md:180-186`, `render-and-redesign-plan.md:376-396`）。

## 最終提言

この設計問いへの答えは **Yes, but narrowly** である。
**Selection Pane 名を権威ソースにすること自体は、mapping の曖昧さを減らし、このアプリをより信頼性の高いものにできる。** ただし最初の一歩は、**AI 名付き placeholder に限定した name-first mapping + stronger validation** に留めるべきで、**任意非-placeholder shape への runtime 直接書き込み**は第二段階以降に分離するのが妥当である（`current-mapping.md:86-93`, `render-and-redesign-plan.md:166-213`, `render-and-redesign-plan.md:398-406`）。
