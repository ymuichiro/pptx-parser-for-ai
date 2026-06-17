# P1: default design と日本語 visual regression

## Problem

default template は premium monochrome tone に近づいており、社内資料や提案下書きには使える水準になっている。ただし、本番サービスとして「海外向け・日本人向けの両方で十分に整った PowerPoint を安定生成できる」と保証するには、日本語 font、長文収まり、PowerPoint export 画像での visual regression が不足している。

テンプレート差し込み方式は正しくても、出力スライドの見た目が崩れるとサービス価値が落ちる。default template は品質基準として継続的に検証できる必要がある。

## Evidence

- `design-quality.md` は、default design の方向性は良いが、日本語資料では `Aptos` 固定が弱く、CJK font と長文 stress test が必要と評価している。
- `design-quality.md` は、PowerPoint export 画像での継続的な visual regression がなく、text clipping、watermark overlap、icon distortion、border regression を検出できないと評価している。
- `template-portability.md` も default template の日本語・海外向け visual regression 追加を P2 候補として挙げている。
- ユーザー要件では、default でも十分デザインが整い、日本人向けプレゼンテーションにも使えることが期待されている。

## Scope

- 日本語・英語の default sample deck を用意する。
- CJK font policy を決める。
- 長文 title、card、list、table、chart の収まりを検証する。
- PowerPoint export 画像または同等の実レンダリング画像による visual regression を追加する。
- icon / logo 比率、枠線混入、watermark overlap、text clipping を検出する。
- default template の design token と layout geometry を保守しやすくする。

対象外:

- すべての企業ブランドに合わせた自動デザイン生成。
- 任意画像や写真素材の自由挿入。
- 完全な DTP 品質保証。

## Acceptance Criteria

- 日本語向け sample deck と海外向け sample deck が用意されている。
- default template から生成した PPTX を PowerPoint export 画像として比較できる。
- 日本語 title / subtitle / card body / list / table で clipping が検出されない、または capacity validation で render 前に警告できる。
- CJK font fallback が仕様化され、macOS / Windows / container の想定環境で破綻しない。
- icon / logo / badge の縦横比が visual regression で検出できる。
- card / panel の意図しない枠線復活が visual regression で検出できる。
- watermark が本文や重要図表に重なる regression を検出できる。
- visual baseline 更新手順がドキュメント化されている。

## Suggested Implementation

- `examples/enterprise-eval/` に日本語 stress deck と英語 business deck を固定 fixture として置く。
- PowerPoint export が使える環境では PDF / PNG を生成し、contact sheet を保存する。
- CI で PowerPoint が使えない場合は、visual regression を optional job にし、少なくとも template XML の geometry / border / aspect ratio 検査を必須にする。
- `scripts/make_default_template.py` の font、spacing、color、card、watermark、badge を design token として整理する。
- text capacity は layout 別に目安文字数を持ち、超過時は validation warning または render-time issue として返す。
- CJK font は PowerPoint で実用的な日本語 font stack を決め、default template と rendering style の両方に反映する。

## Tests

- Integration: 日本語 sample deck と英語 sample deck が default template で render できる。
- Visual: generated slide image を baseline と比較し、許容差を超えた差分を検出する。
- Structural: card / panel border が意図せず復活していない。
- Structural: icon / badge / logo 相当 placeholder の実寸比率が正方形を保つ。
- Structural: watermark shape が foreground content より前に出ていない。
- Validation: 日本語長文 fixture で clipping risk または capacity warning を検出する。
