# Default Enterprise Design Regression

Date: 2026-06-08

## Scope

This check protects the built-in `default` template as an enterprise-ready baseline for English and Japanese decks. It does not cover authentication, artifact ownership, or user-upload onboarding.

## Fixed Samples

- English deck: `examples/enterprise-eval/default-enterprise-en.yaml`
- Japanese deck: `examples/enterprise-eval/default-enterprise-ja.yaml`

Both samples use the server-managed `templates/default.pptx` and `templates/default.manifest.json` contract. They cover cover, section divider, agenda, comparison, cards, chart, table, list, image caption, appendix, and closing layouts.

## Automated Regression

Run:

```sh
uv run pytest tests/integration/test_default_template_asset.py
```

The test suite verifies:

- both English and Japanese enterprise samples render through the default template
- Japanese/CJK text uses `Yu Gothic` instead of relying on `Aptos`
- English output remains on the Latin `Aptos` policy
- Japanese cover and major title slots apply a limited CJK size adjustment so long headings do not keep a rigid 40pt cover title that can leave a one-character final line
- the default cover `AI_TITLE` placeholder keeps enough width for the fixed Japanese sample heading
- background-only decoration and visual-field blocks are absent from the generated default template
- content-shaping card and panel regions stay present and borderless
- icon and badge regions remain square in PowerPoint EMU units
- content-shaping badge regions stay present
- sample text stays within a conservative structural capacity budget

## Manual Visual Pass

Generate review PPTX files:

```sh
uv run pptx-template-render \
  --template templates/default.pptx \
  --manifest templates/default.manifest.json \
  --deck examples/enterprise-eval/default-enterprise-en.yaml \
  --output examples/enterprise-eval/default-enterprise-en.generated.pptx

uv run pptx-template-render \
  --template templates/default.pptx \
  --manifest templates/default.manifest.json \
  --deck examples/enterprise-eval/default-enterprise-ja.yaml \
  --output examples/enterprise-eval/default-enterprise-ja.generated.pptx
```

Review in PowerPoint, or generate a QuickLook thumbnail with `qlmanage -t -s 1600 -o /tmp/pptx-default-ja-ql examples/enterprise-eval/default-enterprise-ja.generated.pptx`. Check for obvious text clipping, title/body imbalance, background-only decoration, icon distortion, missing content cards/panels/badges, and accidental card borders.

For the Japanese deck, specifically inspect the cover title `生成AI活用基盤の運用モデル`. It should remain visually large and must not render as an isolated final line such as `ル` in QuickLook or PowerPoint preview.

## Remaining Limit

The automated capacity check is structural. It catches regressions in font policy, shape geometry, and sample text density, but it is not a full PowerPoint-native text overflow engine. Very long generated content should still be split into additional slides by the upstream deck authoring process.
