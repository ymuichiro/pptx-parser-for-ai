このファイルは、このアプリケーションの現在の仕様を示す source of truth です。

AIまたは開発者が実装・修正を行う場合、まずこのファイルを確認すること。
チャット上の過去の発言よりも、このファイルの内容を優先する。

---

## 1. アプリケーション概要

### 目的

このアプリケーションは、**PowerPoint テンプレートをサーバー側で管理し、semantic deck JSON を差し込んで `.pptx` を生成する MCP サーバー**である。

- テンプレートの見た目・レイアウトは、事前に用意された `.pptx` / `.potx` が持つ
- コンテンツは deck JSON が持つ
- manifest が semantic slot と PowerPoint placeholder `idx` を結び付ける
- 通常の render では、Python が新しいスライド UI やレイアウトを描き起こさず、template の既存 placeholder / content 領域へ差し込む
- deck JSON の詳細仕様は `SEMANTIC_DECK_SPEC.md` を参照する

### 主な利用者

- **AI クライアント**: MCP ツールとしてプレゼン資料生成を実行する
- **テンプレート運用者**: テンプレートファイルをテンプレートディレクトリに配置する
- **開発者**: deck schema、manifest 生成、レンダリング処理を保守する

### 主要ユースケース

このアプリケーションで必ず成立すべき主要な利用シナリオは以下。

1. 運用者が `.pptx` / `.potx` をテンプレートディレクトリへ配置する
2. AI クライアントが `render_presentation` を呼び出し、semantic deck JSON から `.pptx` を生成する
3. AI クライアントが `template_name` を省略した場合でも、`default` テンプレートがあればそれで生成できる

---

## 2. 非目的・やらないこと

このアプリケーションでは、現時点で以下は扱わない。

- エンドユーザー向けの GUI / Web 画面
- YAML ファイルそのものの直接パース
- ユーザーアップロードによるテンプレート選択を通常フローの前提にすること
- 環境変数 JSON による `名前 -> テンプレートパス` のマッピング
- 任意画像パス、base64 画像、外部 URL 画像の受け入れ
- 組み込みの認証・認可基盤

補足:

- YAML を上流で扱うこと自体は否定しないが、このアプリケーションの入力契約は **semantic deck JSON** である
- 高度用途向けに `render_presentation_custom` は残すが、通常運用の主経路ではない

---

## 3. 現在の機能一覧

| 機能 | 概要 | 状態 |
| ---- | ---- | ---- |
| Health endpoint | `/health` で稼働確認を返す | implemented |
| Artifact download | 生成済み `.pptx` を `/artifacts/{token}` から取得できる | implemented |
| Streamable HTTP MCP | `/mcp` / `/mcp/` で MCP ツールを提供する | implemented |
| Supported layout listing | semantic layout 一覧を返す | implemented |
| Icon listing | 利用可能なアイコン参照を返す | implemented |
| Template inspection | `.pptx` / `.potx` の layout / placeholder 情報を調査する | implemented |
| Mapping proposal | inspection から manifest 候補を作る | implemented |
| Manifest finalization | proposal と override から manifest を確定する | implemented |
| Manifest validation | template bytes と manifest の整合性を検証する | implemented |
| Deck validation | deck schema と manifest 収容性を検証する | implemented |
| Template registry | テンプレートディレクトリを走査しサーバー管理テンプレートをロードする | implemented |
| Template listing | `list_templates` で利用可能テンプレートを列挙する | implemented |
| Default fallback render | `template_name` 未指定 / null / 空文字 / 空白時に `default` を使って生成する | implemented |
| Named template render | `template_name` を明示指定して生成する | implemented |
| Custom render | `template_b64 + manifest` で直接生成する高度用途向け経路 | implemented |

状態の意味:

- `planned`: 仕様は決まっているが未実装
- `implemented`: 実装済み
- `deprecated`: 将来的に削除予定
- `unknown`: 実態確認が必要

---

## 4. ドメイン用語

このアプリケーションで使う重要な用語を定義する。

| 用語 | 意味 |
| ---- | ---- |
| Template file | サーバーが保持する `.pptx` または `.potx`。見た目と slide layout を定義する |
| Manifest | semantic layout / slot を PowerPoint placeholder `idx` に対応付けた JSON。起動時に template から生成される |
| Template registry | テンプレートディレクトリを走査して有効テンプレートをメモリ上へロードしたもの |
| Template name | テンプレートファイルの stem を lowercase 正規化した名前 |
| Default template | stem が `default` のテンプレート。未指定系入力のフォールバック先 |
| Deck | 生成対象の semantic deck JSON |
| Semantic layout | `cover_title` や `list_basic` など、アプリケーションが理解する論理スライド種別 |
| Slot | 各 semantic layout 内の差し込み単位。例: `title`, `items`, `metric.value` |
| Placeholder idx | PowerPoint 側 placeholder の `idx`。manifest はこれに対して書き込む |
| Artifact | 一時保存された生成済み `.pptx` と、そのダウンロード URL |
| Icon ref | 内蔵アイコンを指定する JSON。画像の唯一の通常入力形式 |

注意:
同じ意味のものに複数の名前を使わない。
コード、API、ドキュメントで可能な限り同じ用語を使う。

---

## 5. 主要な業務ルール・不変条件

実装時に絶対に壊してはいけないルール。

- テンプレートは **テンプレートディレクトリ配下の `.pptx` / `.potx`** のみを通常フローで利用する
- 通常フローでは、各テンプレートの manifest は **起動時に template bytes から自動生成**する
- 生成された manifest の `template_fingerprint` は、対応するテンプレート bytes と一致しなければならない
- 生成された manifest が template と整合しない場合、そのテンプレートはロードしてはいけない
- template name はファイル stem を **lowercase 正規化**して扱う
- Microsoft Office 組み込みの slide layout 名は、既知の locale 名から **英語 canonical 名として自動解釈**できなければならない
- `default.pptx` と `default.potx` は同時に有効化できない。normalized name が重複するため **起動エラー** とする
- `render_presentation` で `template_name` が **未指定 / null / 空文字 / 空白のみ** の場合は、`default` へフォールバックする
- フォールバック要求時に `default` が存在しない場合は、`TEMPLATE_NOT_FOUND` ではなく **`DEFAULT_TEMPLATE_NOT_FOUND`** を返す
- 発見した各 template は、**同じ semantic layout 群**を満たさなければならない
- 起動時に template の mapping 生成や contract 検証に失敗した場合は、warning で継続せず **起動失敗** とする
- deck の入力契約は **JSON** であり、root は `version`, `meta`, `slides` を基本とする
- slide の種別指定は `type` ではなく **`layout`** を使う
- 出力ファイルは必ず **PowerPoint テンプレートをベースに生成した `.pptx`** である
- 通常フローの render は **template に存在しない新規レイアウト装飾を Python 側で描き起こしてはいけない**
- 任意画像 URL、ローカルファイルパス、base64 画像は通常フローで受け付けてはいけない

これらのルールに反する実装をしてはいけない。
判断に迷う場合は、実装前に仕様確認が必要。

---

## 6. ユーザーフロー

### フロー: テンプレート登録

目的:

- サーバーで利用可能な PowerPoint テンプレートを追加する

手順:

1. 運用者が `.pptx` または `.potx` を準備する
2. テンプレートファイルをテンプレートディレクトリへ配置する
3. サーバーを再起動する

正常系:

- テンプレートが起動時に解析され、mapping が自動生成され、registry にロードされる
- 組み込み layout 名が日本語などに localize されていても、既知の Microsoft Office 名は英語 canonical 名として解釈される

異常系:

- template を開けない: 起動失敗
- mapping を生成できない: 起動失敗
- 共通 semantic layout contract を満たさない: 起動失敗
- normalized name 重複: 起動失敗

完了条件:

- `list_templates` で対象テンプレート名と supported layouts を確認できる

### フロー: デフォルトテンプレートで資料生成

目的:

- AI クライアントが template 名を意識せずに資料生成する

手順:

1. 運用者が `default.pptx` または `default.potx` を配置する
2. AI クライアントが `render_presentation` を `template_name` 省略または空入力で呼ぶ
3. サーバーが `default` を解決し、deck JSON を埋め込んで `.pptx` を生成する
4. クライアントが artifact URL からファイルを取得する

正常系:

- `.pptx` が生成され、`download_url` と `slideCount` が返る

異常系:

- `default` が存在しない: `DEFAULT_TEMPLATE_NOT_FOUND`
- deck schema 不正: `DECK_SCHEMA_INVALID` など
- manifest とテンプレートの整合が取れない: validation 系エラー

完了条件:

- ダウンロード可能な `.pptx` artifact が返る

### フロー: 指定テンプレートで資料生成

目的:

- AI クライアントが `corporate` など任意のテンプレートを明示選択して生成する

手順:

1. クライアントが `list_templates` で available templates を確認する
2. `render_presentation(template_name="corporate", deck=...)` を呼ぶ
3. サーバーが該当テンプレートを解決して `.pptx` を生成する

正常系:

- 指定テンプレートをベースにした `.pptx` が生成される

異常系:

- 指定名が存在しない: `TEMPLATE_NOT_FOUND`

完了条件:

- 指定 template 名に対応するデザインで `.pptx` が返る

---

## 7. 画面仕様

このアプリケーションは **画面を持たないサーバーアプリケーション** である。

| 画面 | パス | 目的 | 主な操作 |
| ---- | ---- | ---- | -------- |
| なし | なし | UI は提供しない | なし |

### 画面ごとの注意点

#### UI なし

- 操作インターフェースは HTTP / MCP のみ
- 利用者は MCP クライアント、CLI、テストクライアント等を想定する

---

## 8. API仕様

このセクションでは、実装上重要な API 契約のみを書く。

| Method | Path | 説明 | 認可 |
| ------ | ---- | ---- | ---- |
| GET | `/health` | 稼働確認。`ok` を返す | なし |
| GET | `/artifacts/{token}` | 生成済み artifact のダウンロード | なし |
| POST | `/mcp` | MCP エンドポイント | なし |
| POST | `/mcp/` | MCP エンドポイント（同等） | なし |

### API設計方針

- 主インターフェースは OpenAPI ではなく **MCP ツール呼び出し**である
- `/mcp` と `/mcp/` は POST redirect を発生させず同等に扱う
- ツールエラーは `DomainError` を `ToolError` として返す
- 通常フローの資料生成は `render_presentation` を使う
- 高度用途や運用用途のみ `render_presentation_custom` を使う

### 主要 MCP ツール

| ツール名 | 用途 |
| -------- | ---- |
| `list_supported_layouts` | semantic layout と slot 契約を返す |
| `list_icons` | 利用可能な icon ref を返す |
| `inspect_template` | `.pptx` / `.potx` から layout / placeholder 情報を取得する |
| `propose_mapping` | inspection から manifest 候補を作る |
| `finalize_manifest` | proposal を完成 manifest にする |
| `validate_manifest` | manifest と template bytes の整合性を検証する |
| `validate_deck` | deck schema と manifest 収容性を検証する |
| `list_templates` | 現在ロード済み template 一覧を返す |
| `render_presentation` | サーバー管理テンプレートで `.pptx` を生成する |
| `render_presentation_custom` | caller supplied template + manifest で `.pptx` を生成する |

### `render_presentation` 契約

入力:

```json
{
  "deck": {
    "version": 1,
    "meta": {"title": "Example"},
    "slides": [
      {"layout": "cover_title", "title": "Cover", "subtitle": "Subtitle"}
    ]
  },
  "template_name": "corporate",
  "file_name": "output.pptx"
}
```

仕様:

- `deck` は必須
- `template_name` は任意
- `template_name` が omitted / `null` / `""` / whitespace-only の場合は `default` へフォールバックする
- `file_name` は任意。未指定時は `deck.meta.title` か `presentation.pptx` を使う

成功時レスポンスの要点:

- `success: true`
- `download_url`
- `expires_at`
- `file_name`
- `slideCount`

---

## 9. データモデル

詳細な DB スキーマではなく、AI がドメイン構造を誤解しないための概念モデルを書く。

### 主要エンティティ

#### TemplateEntry

意味:

- サーバー起動時に registry がロードした有効テンプレート

主な属性:

| 属性 | 意味 | 備考 |
| ---- | ---- | ---- |
| name | normalized template name | lowercase stem |
| description | 人間向け説明 | manifest 由来 |
| template_bytes | 元の `.pptx` / `.potx` bytes | レンダリング元 |
| manifest | template に対応する finalized manifest | fingerprint 一致必須 |
| supported_layouts | template が収容できる semantic layout 一覧 | `list_templates` で返す |

#### Deck

意味:

- 生成対象の semantic presentation 定義

主な属性:

| 属性 | 意味 | 備考 |
| ---- | ---- | ---- |
| version | deck schema version | 現在は `1` 固定 |
| meta | 任意メタ情報 | `title` など |
| slides | slide 配列 | 1件以上必須 |

#### Slide

意味:

- semantic layout を持つ 1 枚のスライド

主な属性:

| 属性 | 意味 | 備考 |
| ---- | ---- | ---- |
| layout | semantic layout 名 | `type` ではない |
| title | タイトル | 多くの layout で必須 |
| subtitle / items / table / chart など | layout ごとの slot 値 | manifest で placeholder に流し込む |

#### Artifact

意味:

- 一時公開される生成済み `.pptx`

主な属性:

| 属性 | 意味 | 備考 |
| ---- | ---- | ---- |
| token | artifact 識別子 | download path に使う |
| file_name | ダウンロード名 | 出力ファイル名 |
| download_url | ダウンロード URL | TTL あり |
| expires_at | 有効期限 | artifact TTL に従う |

関係:

- TemplateEntry は 1 つの manifest を持つ
- Deck は複数の Slide を持つ
- render 処理は TemplateEntry と Deck から Artifact を生成する

---

## 10. 認証・認可

### 認証方式

- **現在は組み込み認証なし**

### ロール

| ロール | 権限 |
| ------ | ---- |
| なし | 認証ロールモデルは持たない |

### 認可ルール

- アプリケーション内部でユーザー単位の認可は行わない
- 外部公開時のアクセス制御は、リバースプロキシ、ネットワーク制御、トンネル設定など運用側で担保する

---

## 11. AI機能・LLM利用方針

このアプリケーションは **AI を内蔵して推論するアプリではなく、AI クライアントから利用されるツールサーバー** である。

### AIの役割

- semantic deck JSON を組み立てる
- 必要なら `list_templates` で利用可能テンプレートを確認する
- 通常は `render_presentation` で資料生成を実行する
- template 運用時には `inspect_template -> propose_mapping -> finalize_manifest` を使う

### AIがしてはいけないこと

- 存在しない template 名を勝手に決め打ちしない
- `type` フィールドで slide layout を送らない
- 任意画像 URL やローカルファイルパスを image slot として送らない
- `template_name` を空文字にしてもエラーになると誤解しない。現在仕様では `default` へフォールバックする
- 高度用途でないのに `render_presentation_custom` を通常フローとして使わない

### プロンプト・ツール利用方針

- 通常の資料生成は `render_presentation` を第一選択にする
- 特定 template を使いたい場合のみ `template_name` を明示指定する
- template 指定に自信がない場合は、`list_templates` を確認するか `template_name` を省略して `default` を使う
- deck schema や manifest に存在しない field を作らない

---

## 12. 外部サービス・依存関係

| サービス / 依存 | 用途 | 備考 |
| --------------- | ---- | ---- |
| FastMCP | MCP ツールサーバー | HTTP でツール提供 |
| Starlette | ASGI アプリ | middleware / route 管理 |
| Uvicorn | ASGI サーバー | 実行基盤 |
| python-pptx | PowerPoint 読み書き | `.pptx` 生成の中核 |
| lxml | PowerPoint XML 操作補助 | template 生成補助などで使用 |
| Docker / docker compose | ローカル運用 | app / proxy / tunnel 構成 |
| Cloudflare tunnel | 任意の外部公開手段 | compose profile で利用 |
| Icon registry | アイコン解決 | 通常の image slot 入力元 |

補足:

- コアの資料生成機能は OpenAI API 等の外部 LLM に依存しない
- テンプレート配布はテンプレートディレクトリのボリュームマウントで行う

---

## 13. エラーハンドリング方針

### ユーザーに見せるエラー

- `NO_TEMPLATES_CONFIGURED`: 利用可能テンプレートが 1 件もない
- `DEFAULT_TEMPLATE_NOT_FOUND`: フォールバック先の `default` がない
- `TEMPLATE_NOT_FOUND`: 明示指定 template が存在しない
- `TEMPLATE_FINGERPRINT_MISMATCH`: 生成された manifest と template が不一致
- `TEMPLATE_REGISTRY_LOAD_FAILED`: 起動時の template 解析・mapping 生成に失敗した
- `TEMPLATE_LAYOUT_CONTRACT_MISMATCH`: template が共通 semantic layout contract を満たさない
- `DUPLICATE_TEMPLATE_NAME`: lowercase 正規化後の template 名が重複した
- `DECK_SCHEMA_INVALID`: deck JSON の構造が不正
- `SEMANTIC_LAYOUT_NOT_FOUND`: 未知の layout、または manifest に存在しない layout
- `PLACEHOLDER_IDX_NOT_FOUND`: manifest が指す idx が実 template に存在しない
- `PPT_LAYOUT_NOT_FOUND`: manifest が参照する PowerPoint layout 名が template に存在しない

### ログに残すべきエラー

- テンプレートロード失敗
  - template open failure
  - mapping generation failure
  - duplicate normalized name
  - common layout contract violation
- render 失敗のうち、再現や運用判断に必要なもの

### ログに残してはいけない情報

- APIキー
- 認証情報
- 個人情報
- 機密情報を含む deck の全文
- 外部システム由来の秘匿情報

---

## 14. セキュリティ・プライバシー要件

最低限守るべき事項。

- ユーザー入力 deck は必ず server-side validation を通す
- trusted hosts 制御を維持する
- request size / output size 制限を維持する
- 通常フローでは外部 URL 画像やローカルファイル画像を受け付けない
- テンプレートファイルはサーバー運用者が管理し、一般利用者に template bytes の直接提出を強制しない
- artifact は永続公開しない。一時 URL と TTL を使う

---

## 15. テスト方針

### 必須テスト

- template registry のロード、重複、missing manifest、stale manifest のユニットテスト
- `render_presentation` の default fallback、named template、missing default のサーバーテスト
- `.pptx` / `.potx` を使った render flow の統合テスト
- deck validation のユニットテスト
- `/mcp` と `/mcp/` が redirect なしで同等に動くテスト

### AIがコード変更時に確認すべきコマンド

```bash
.venv/bin/pytest tests/ -x -q
```
