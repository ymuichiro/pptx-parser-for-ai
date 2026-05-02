# SEMANTIC_DECK_SPEC.md

このファイルは、このアプリケーションが受け付ける **semantic deck JSON** の仕様書です。

- `APP_SPEC.md` がアプリケーション全体の仕様
- `SEMANTIC_DECK_SPEC.md` が **deck 入力データ構造の詳細仕様**

実装・修正・AI 利用時は、このファイルを deck の source of truth として扱うこと。

---

## 1. semantic deck JSON とは

semantic deck JSON とは、**PowerPoint の見た目ではなく、スライドの意味構造を表す JSON** です。

このアプリケーションでは次のように責務を分離します。

| 要素 | 責務 |
| ---- | ---- |
| Template (`.pptx` / `.potx`) | 見た目、slide layout、placeholder の位置 |
| Manifest (`.manifest.json`) | semantic field と placeholder `idx` の対応 |
| Semantic deck JSON | スライドの意味とコンテンツ |

つまり、semantic deck JSON は「どのレイアウトのスライドに、どんな内容を入れるか」を表現します。

---

## 2. root 構造

deck 全体は JSON object で、許可される root key は次の 3 つだけです。

- `version`
- `meta`
- `slides`

### 最小構造

```json
{
  "version": 1,
  "slides": [
    {
      "layout": "cover_title",
      "title": "Example",
      "subtitle": "Subtitle"
    }
  ]
}
```

### root ルール

| フィールド | 型 | 必須 | ルール |
| ---------- | -- | ---- | ------ |
| `version` | integer | 必須 | **必ず `1`** |
| `meta` | object | 任意 | object であること |
| `slides` | array | 必須 | **1件以上**必要 |

### root の注意点

- root に未知の field を入れてはいけない
- `version != 1` は不正
- `slides` は空配列不可
- `meta` は任意だが、指定するなら object である必要がある

---

## 3. slide 共通ルール

各 slide は object である必要があります。

### 共通フィールド

| フィールド | 型 | 必須 | 備考 |
| ---------- | -- | ---- | ---- |
| `layout` | string | 必須 | semantic layout 名 |
| `id` | string | 任意 | 任意識別子。レンダリング上の必須意味はない |
| `title` | string | 多くで必須 | ほぼ全 layout で required |
| `subtitle` | string | layout により任意/必須 | `cover_title` では必須 |

### 共通バリデーション

- slide は object でなければならない
- `layout` はサポート済み semantic layout 名でなければならない
- `title` は空白のみでは不可
- **`type` は使わない**  
  `type` を送るとエラーになります。必ず `layout` を使います。

### 共通の重要ルール

1. **未知のフィールドは禁止**
2. **layout ごとに許可された key だけを使う**
3. `render_presentation` 時に manifest を渡さない通常フローでも、内部的には選ばれた template の manifest に収まる必要がある
4. manifest に存在しない layout を deck で使うとエラーになる

---

## 4. 利用可能な semantic layouts 一覧

現在サポートされる layout は次の 15 種類です。

1. `cover_title`
2. `section_divider`
3. `agenda`
4. `list_basic`
5. `table_basic`
6. `comparison_2col`
7. `three_cards_vertical`
8. `three_cards_horizontal`
9. `timeline`
10. `closing_end`
11. `kpi_big_number`
12. `chart_basic`
13. `image_caption`
14. `appendix_backup`
15. `eol_notice`

---

## 5. layout 別仕様

この章では、各 slide の field を **許可 field / required field / 例** まで明示します。

### 5.1 `cover_title`

**用途**: 表紙スライド

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `date`
- `organization`
- `author`

**required**

- `title`
- `subtitle`

**例**

```json
{
  "layout": "cover_title",
  "title": "Quarterly Review",
  "subtitle": "FY2026 Q1",
  "organization": "AI Platform"
}
```

---

### 5.2 `section_divider`

**用途**: セクション区切り

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `section_no`

**required**

- `title`

**例**

```json
{
  "layout": "section_divider",
  "title": "Market Context",
  "section_no": "01"
}
```

---

### 5.3 `agenda`

**用途**: アジェンダ

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `items`

**required**

- `title`
- `items`

**例**

```json
{
  "layout": "agenda",
  "title": "Agenda",
  "items": ["Overview", "Plan"]
}
```

---

### 5.4 `list_basic`

**用途**: 箇条書きリスト

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `items`
- `list_style`

**required**

- `title`
- `items`

**注意**

- `list_style` は schema 上は許可されるが、現行レンダラで特別な描画ロジックは持たない

**例**

```json
{
  "layout": "list_basic",
  "title": "Priorities",
  "list_style": "bullet",
  "items": [
    {"text": "Quality", "level": 0},
    {"text": "Velocity", "level": 1}
  ]
}
```

---

### 5.5 `table_basic`

**用途**: 表

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `table`
- `caption`

**required**

- `title`
- `table`

**例**

```json
{
  "layout": "table_basic",
  "title": "Plan",
  "table": {
    "headers": ["Q", "Revenue"],
    "rows": [["Q1", 10]]
  }
}
```

---

### 5.6 `comparison_2col`

**用途**: 左右比較

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `left`
- `right`

**required**

- `title`
- `left`
- `right`

`left` / `right` の内部で許可される field:

- `title`
- `description`
- `bullets`
- `icon`

`left` / `right` の内部 required:

- `title`
- `description`

**例**

```json
{
  "layout": "comparison_2col",
  "title": "Old vs New",
  "left": {
    "title": "Old",
    "description": "Before"
  },
  "right": {
    "title": "New",
    "description": "After"
  }
}
```

---

### 5.7 `three_cards_vertical`

**用途**: 3カード（縦系）

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `cards`

**required**

- `title`
- `cards`

`cards` ルール:

- **必ず 3 件**
- 各 card は object
- 各 card で許可される field:
  - `title`
  - `description`
  - `icon`
- 各 card の required:
  - `title`
  - `description`

**例**

```json
{
  "layout": "three_cards_vertical",
  "title": "Pillars",
  "cards": [
    {"title": "A", "description": "..."},
    {"title": "B", "description": "..."},
    {"title": "C", "description": "..."}
  ]
}
```

---

### 5.8 `three_cards_horizontal`

**用途**: 3カード（横系）

仕様は `three_cards_vertical` と同じです。

**例**

```json
{
  "layout": "three_cards_horizontal",
  "title": "Pillars",
  "cards": [
    {"title": "A", "description": "..."},
    {"title": "B", "description": "..."},
    {"title": "C", "description": "..."}
  ]
}
```

---

### 5.9 `timeline`

**用途**: タイムライン

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `events`

**required**

- `title`
- `events`

`events` ルール:

- 非空配列
- 各 event は object
- 許可される field:
  - `label`
  - `title`
  - `description`
  - `icon`
- 各 event は **`label` / `title` / `description` のどれか 1 つ以上**が必要

**容量ルール**

- デフォルトでは最大 8 イベント想定
- ただし実際には **manifest に存在する `events[n]` の最大 index** が上限になる
- event 数が manifest の収容数を超えると `OVERFLOW_POLICY_VIOLATION`

**例**

```json
{
  "layout": "timeline",
  "title": "Roadmap",
  "events": [
    {
      "label": "Q1",
      "title": "Plan",
      "description": "Start"
    }
  ]
}
```

---

### 5.10 `closing_end`

**用途**: 締めスライド

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `message`
- `contact`
- `cta`

**required**

- `title`

**例**

```json
{
  "layout": "closing_end",
  "title": "Thank You",
  "contact": "team@example.com"
}
```

---

### 5.11 `kpi_big_number`

**用途**: KPI 大数字

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `metric`
- `supporting_points`

**required**

- `title`
- `metric`

`metric` 内部で許可される field:

- `value`
- `label`
- `unit`
- `delta`

`metric` 内部 required:

- `value`

**例**

```json
{
  "layout": "kpi_big_number",
  "title": "Growth",
  "metric": {
    "value": "42",
    "label": "Customers"
  }
}
```

---

### 5.12 `chart_basic`

**用途**: 基本グラフ

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `chart`
- `caption`

**required**

- `title`
- `chart`

**例**

```json
{
  "layout": "chart_basic",
  "title": "Sales",
  "chart": {
    "kind": "column",
    "categories": ["Q1", "Q2"],
    "series": [
      {"name": "Sales", "values": [10, 12]}
    ]
  }
}
```

---

### 5.13 `image_caption`

**用途**: アイコン + キャプション

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `icon`
- `caption`
- `attribution`

**required**

- `title`
- `icon`

**重要**

- ここでの `icon` は **任意画像ではなく icon ref**
- ローカル画像パス、base64 画像、外部 URL は不可

**例**

```json
{
  "layout": "image_caption",
  "title": "Upload",
  "icon": {
    "pack": "heroicons",
    "name": "cloud-arrow-up",
    "variant": "outline"
  }
}
```

---

### 5.14 `appendix_backup`

**用途**: appendix / backup

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `body`
- `items`
- `references`

**required**

- `title`

**例**

```json
{
  "layout": "appendix_backup",
  "title": "Appendix",
  "items": ["Detail"]
}
```

---

### 5.15 `eol_notice`

**用途**: EOL / EOS 告知

**許可 field**

- `layout`
- `id`
- `title`
- `subtitle`
- `product_name`
- `end_of_sale`
- `end_of_support`
- `replacement`
- `actions`

**required**

- `title`
- `product_name`

**例**

```json
{
  "layout": "eol_notice",
  "title": "EOL Notice",
  "product_name": "Legacy API",
  "actions": ["Migrate"]
}
```

---

## 6. 複合型フィールド仕様

### 6.1 list (`items`, `supporting_points`, `actions`, `references`, `left.bullets`, `right.bullets`)

list は **非空 array** です。

各要素は次のどちらか:

1. string
2. object

object 形式の場合の許可 field:

- `text`
- `level`

例:

```json
[
  "Top level bullet",
  {"text": "Indented bullet", "level": 1}
]
```

ルール:

- string は空文字不可
- object の `text` は必須
- `level` は任意

---

### 6.2 table

table は object で、許可 field は次の 2 つだけです。

- `headers`
- `rows`

例:

```json
{
  "headers": ["Q", "Revenue"],
  "rows": [
    ["Q1", 10],
    ["Q2", 12]
  ]
}
```

ルール:

- `headers` は非空 array
- `rows` は array
- 各 row は array
- **各 row の長さは headers 長と一致しなければならない**

---

### 6.3 chart

chart は object で、許可 field は次の 3 つだけです。

- `kind`
- `categories`
- `series`

`kind` の許可値:

- `bar`
- `column`
- `line`
- `pie`

例:

```json
{
  "kind": "column",
  "categories": ["Q1", "Q2"],
  "series": [
    {"name": "Sales", "values": [10, 12]}
  ]
}
```

ルール:

- `categories` は非空 array
- `series` は非空 array
- 各 series item は object
- 各 series item は `name` と `values` を持つ
- `values` の長さは `categories` と一致しなければならない

---

### 6.4 icon ref

icon ref は、内蔵 icon registry で解決可能な object です。

代表例:

```json
{
  "pack": "heroicons",
  "name": "cloud-arrow-up",
  "variant": "outline",
  "color": "#2563EB"
}
```

注意:

- 使える icon は `list_icons` で確認する
- **任意画像は icon ref の代わりにならない**
- `image_caption.icon`、`cards[n].icon`、`timeline.events[n].icon`、`comparison_2col.left/right.icon` などで使う

---

## 7. manifest との関係

semantic deck JSON は単独でも schema 検証できますが、**実際の render 可否は manifest に依存**します。

### manifest に依存する点

1. 指定した `layout` が、その template の manifest に存在するか
2. timeline の event 数が、その manifest の収容上限を超えていないか
3. 各 slot がその template の placeholder に正しく割り当てられているか

### 重要な理解

- semantic deck JSON は「意味」の定義
- manifest は「その意味を、この template のどこへ書くか」の定義
- そのため、**同じ deck JSON でも template / manifest によって見た目は変わる**

---

## 8. よくある誤解

### 誤解 1: YAML をそのまま渡せばよい

違います。  
このアプリケーションの入力契約は **semantic deck JSON** です。

YAML を上流で使う場合は、最終的にこの JSON 形へ変換してから渡します。

### 誤解 2: slide の種類は `type` で指定する

違います。  
**`layout`** を使います。

### 誤解 3: `image_caption` に画像 URL を渡せる

できません。  
`image_caption` は通常フローでは **icon ref** だけを受け付けます。

### 誤解 4: `template_name` は deck の中に入れる

違います。  
`template_name` は `render_presentation` の **ツール引数**です。deck 本体には入りません。

### 誤解 5: `meta` に何を入れてもよい

`meta` 自体は任意 object ですが、deck root には `version`, `meta`, `slides` 以外の key は入れられません。

---

## 9. 推奨作成手順

AI または開発者が semantic deck JSON を作るときは、次の順番を推奨します。

1. `list_templates` で使用可能 template を確認する
2. `list_supported_layouts` で layout と field 契約を確認する
3. deck root を `version`, `meta`, `slides` で作る
4. 各 slide に `layout` を設定する
5. layout ごとの required field を満たす
6. icon / table / chart / list の複合型をこの仕様どおりに作る
7. template を明示したい場合だけ `template_name` を指定する
8. 迷ったら `template_name` を省略し `default` を使う

---

## 10. 完全例

```json
{
  "version": 1,
  "meta": {
    "title": "Example Deck",
    "language": "ja"
  },
  "slides": [
    {
      "layout": "cover_title",
      "title": "ソフトバンクと OpenAI の関係性",
      "subtitle": "戦略提携と AI ビジネスの展望"
    },
    {
      "layout": "agenda",
      "title": "Agenda",
      "items": [
        "背景",
        "連携の狙い",
        "今後の展望"
      ]
    },
    {
      "layout": "chart_basic",
      "title": "市場成長",
      "chart": {
        "kind": "column",
        "categories": ["2024", "2025", "2026"],
        "series": [
          {"name": "Adoption", "values": [10, 18, 28]}
        ]
      }
    },
    {
      "layout": "closing_end",
      "title": "Thank You",
      "contact": "team@example.com"
    }
  ]
}
```

---

## 11. 変更時の原則

semantic deck JSON の仕様を変える場合は、最低でも次を同時に見直すこと。

1. `src/pptx_yaml_engine/layouts.py`
2. `src/pptx_yaml_engine/output/validation.py`
3. `APP_SPEC.md`
4. `SEMANTIC_DECK_SPEC.md`
5. 関連テスト

deck 仕様変更は、単なるドキュメント変更ではなく **レンダリング契約の変更**です。互換性への影響を必ず確認すること。
