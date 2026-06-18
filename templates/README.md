# templates/

This directory contains server-managed PowerPoint templates.

## Operator instructions

1. Create one PowerPoint slide layout for every supported semantic layout and
   name the layout with that semantic key, such as `cover_title`,
   `agenda`, or `table_basic`.
2. In the Selection Pane, rename every bindable placeholder to the required
   authoritative `AI_*` name for that semantic layout.
3. Place your `.pptx` or `.potx` file here, e.g. `corporate.pptx`.
4. Restart the container (or rebuild if templates are baked into the image).

The server loads templates at startup, inspects each file, generates a strict
manifest in memory from PowerPoint layout names plus `AI_*` placeholder names,
and reuses that generated mapping for later render requests. Server-managed
templates do not require a companion `name.manifest.json` file.

Do not rely on generic built-in layout names such as `Title Slide` or
`Title and Content`, and do not rely on `slot__...`, `placeholder__...`, or
geometry fallback behavior in production templates.

Invalid templates do **not** get skipped. Startup fails fast if a template:

- cannot be opened as PowerPoint
- does not expose the required semantic layout names
- is missing required `AI_*` placeholders
- contains unknown, duplicated, non-placeholder, or incompatible `AI_*` targets
- violates the common semantic layout contract shared by all templates
- collides with another template after lowercase stem normalization

## Repository default template

This repository includes a generated `default.pptx` used as the server fallback
template. Regenerate it with:

```bash
.venv/bin/python scripts/make_default_template.py
```

The generator follows the visual direction in `examples/`, but emits a 16:9
PowerPoint template. `default.manifest.json` is an operator/debug artifact for
local CLI workflows; runtime startup still regenerates the manifest in memory
and does not depend on that file.

## File naming rules

- Names are normalised to lowercase; `Acme.pptx` and `acme.pptx` are treated as
  the same template. Duplicate normalized names are a startup error.
- The stem `default` is reserved for fallback selection. If `default.pptx` or
  `default.potx` is present, the server uses it when `render_presentation` is
  called without a usable `template_name`.
- Do not keep both `default.pptx` and `default.potx` in the same directory;
  they normalize to the same template name and will fail startup as a duplicate.

## Selecting a template at render time

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "render_presentation",
    "arguments": {
        "deck": { ... },
        "file_name": "output.pptx"
      }
    }
  }
```

Use `list_templates` to see which templates are available and which semantic
layouts each one supports.

To force a specific template, pass its stem as `template_name`, for example
`"corporate"`. If `template_name` is omitted, `null`, empty, or whitespace-only,
the server falls back to the template named `default`.

## Authoring contract quick reference

The live contract is returned by `list_supported_layouts`. Use that MCP tool as
the source for automation and checklist generation. The table below mirrors the
current `LAYOUT_SPECS` contract for template authors.

Placeholder type guidance:

- `text`: `TITLE`, `CENTER_TITLE`, `SUBTITLE`, `BODY`, or `OBJECT`
- `list`: `TITLE`, `CENTER_TITLE`, `SUBTITLE`, `BODY`, or `OBJECT`
- `table`: `TABLE`
- `chart`: `CHART`
- `icon`: `PICTURE`; size the placeholder as a visual square

Capacity guidance:

- text: 1-2 short lines
- list: 3-6 concise bullets
- table: 3-5 columns and 3-6 body rows
- chart: up to 6 categories and 1-3 series
- icon: one built-in icon ref

### `cover_title`

PowerPoint layout names: `cover_title`, `cover`, `title_slide`, `yaml__cover_title`

Required placeholders:

- `title` (text): `AI_TITLE`
- `subtitle` (text): `AI_SUBTITLE`

Optional placeholders:

- `date` (text): `AI_DATE`
- `organization` (text): `AI_ORGANIZATION`
- `author` (text): `AI_AUTHOR`

### `section_divider`

PowerPoint layout names: `section_divider`, `section`, `section_header`, `yaml__section_divider`

Required placeholders:

- `title` (text): `AI_TITLE`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `section_no` (text): `AI_SECTION_NO`

### `agenda`

PowerPoint layout names: `agenda`, `toc`, `table_of_contents`, `yaml__agenda`

Required placeholders:

- `title` (text): `AI_TITLE`
- `items` (list): `AI_ITEMS`, `AI_BODY`, `AI_AGENDA_ITEMS`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`

### `list_basic`

PowerPoint layout names: `list_basic`, `list`, `bullets`, `yaml__list_basic`

Required placeholders:

- `title` (text): `AI_TITLE`
- `items` (list): `AI_ITEMS`, `AI_BODY`, `AI_LIST_ITEMS`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`

### `table_basic`

PowerPoint layout names: `table_basic`, `table`, `yaml__table_basic`

Required placeholders:

- `title` (text): `AI_TITLE`
- `table` (table): `AI_TABLE`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `caption` (text): `AI_CAPTION`

### `comparison_2col`

PowerPoint layout names: `comparison_2col`, `comparison`, `2col_compare`, `yaml__comparison_2col`

Required placeholders:

- `title` (text): `AI_TITLE`
- `left.title` (text): `AI_LEFT_TITLE`, `AI_COL1_TITLE`, `AI_COLUMN1_TITLE`, `AI_COL1_HEADING`, `AI_COLUMN1_HEADING`
- `left.description` (text): `AI_LEFT_DESCRIPTION`, `AI_LEFT_BODY`, `AI_COL1_DESCRIPTION`, `AI_COLUMN1_DESCRIPTION`, `AI_COL1_BODY`, `AI_COLUMN1_BODY`
- `right.title` (text): `AI_RIGHT_TITLE`, `AI_COL2_TITLE`, `AI_COLUMN2_TITLE`, `AI_COL2_HEADING`, `AI_COLUMN2_HEADING`
- `right.description` (text): `AI_RIGHT_DESCRIPTION`, `AI_RIGHT_BODY`, `AI_COL2_DESCRIPTION`, `AI_COLUMN2_DESCRIPTION`, `AI_COL2_BODY`, `AI_COLUMN2_BODY`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `left.icon` (icon): `AI_LEFT_ICON`, `AI_COL1_ICON`, `AI_COLUMN1_ICON`
- `left.bullets` (list): `AI_LEFT_BULLETS`, `AI_LEFT_ITEMS`, `AI_COL1_ITEMS`, `AI_COLUMN1_ITEMS`
- `right.icon` (icon): `AI_RIGHT_ICON`, `AI_COL2_ICON`, `AI_COLUMN2_ICON`
- `right.bullets` (list): `AI_RIGHT_BULLETS`, `AI_RIGHT_ITEMS`, `AI_COL2_ITEMS`, `AI_COLUMN2_ITEMS`

### `three_cards_vertical`

PowerPoint layout names: `three_cards_vertical`, `3col_vertical`, `3col`, `3col_cards_vertical`, `three_column`, `three_columns`, `three_cards`, `yaml__three_cards_vertical`

Required placeholders:

- `title` (text): `AI_TITLE`
- `cards[0].title` (text): `AI_CARDS_1_TITLE`, `AI_CARD1_TITLE`, `AI_COL1_TITLE`, `AI_COLUMN1_TITLE`, `AI_CARD1_HEADING`, `AI_COL1_HEADING`, `AI_COLUMN1_HEADING`
- `cards[0].description` (text): `AI_CARDS_1_DESCRIPTION`, `AI_CARD1_DESCRIPTION`, `AI_COL1_DESCRIPTION`, `AI_COLUMN1_DESCRIPTION`, `AI_CARD1_BODY`, `AI_COL1_BODY`, `AI_COLUMN1_BODY`
- `cards[1].title` (text): `AI_CARDS_2_TITLE`, `AI_CARD2_TITLE`, `AI_COL2_TITLE`, `AI_COLUMN2_TITLE`, `AI_CARD2_HEADING`, `AI_COL2_HEADING`, `AI_COLUMN2_HEADING`
- `cards[1].description` (text): `AI_CARDS_2_DESCRIPTION`, `AI_CARD2_DESCRIPTION`, `AI_COL2_DESCRIPTION`, `AI_COLUMN2_DESCRIPTION`, `AI_CARD2_BODY`, `AI_COL2_BODY`, `AI_COLUMN2_BODY`
- `cards[2].title` (text): `AI_CARDS_3_TITLE`, `AI_CARD3_TITLE`, `AI_COL3_TITLE`, `AI_COLUMN3_TITLE`, `AI_CARD3_HEADING`, `AI_COL3_HEADING`, `AI_COLUMN3_HEADING`
- `cards[2].description` (text): `AI_CARDS_3_DESCRIPTION`, `AI_CARD3_DESCRIPTION`, `AI_COL3_DESCRIPTION`, `AI_COLUMN3_DESCRIPTION`, `AI_CARD3_BODY`, `AI_COL3_BODY`, `AI_COLUMN3_BODY`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `cards[0].icon` (icon): `AI_CARDS_1_ICON`, `AI_CARD1_ICON`, `AI_COL1_ICON`, `AI_COLUMN1_ICON`
- `cards[0].combined_text` (text): `AI_CARDS_1_COMBINED_TEXT`, `AI_CARD1_COMBINED_TEXT`, `AI_COL1_COMBINED_TEXT`, `AI_COLUMN1_COMBINED_TEXT`, `AI_CARD1_TEXT`, `AI_COL1_TEXT`, `AI_COLUMN1_TEXT`
- `cards[1].icon` (icon): `AI_CARDS_2_ICON`, `AI_CARD2_ICON`, `AI_COL2_ICON`, `AI_COLUMN2_ICON`
- `cards[1].combined_text` (text): `AI_CARDS_2_COMBINED_TEXT`, `AI_CARD2_COMBINED_TEXT`, `AI_COL2_COMBINED_TEXT`, `AI_COLUMN2_COMBINED_TEXT`, `AI_CARD2_TEXT`, `AI_COL2_TEXT`, `AI_COLUMN2_TEXT`
- `cards[2].icon` (icon): `AI_CARDS_3_ICON`, `AI_CARD3_ICON`, `AI_COL3_ICON`, `AI_COLUMN3_ICON`
- `cards[2].combined_text` (text): `AI_CARDS_3_COMBINED_TEXT`, `AI_CARD3_COMBINED_TEXT`, `AI_COL3_COMBINED_TEXT`, `AI_COLUMN3_COMBINED_TEXT`, `AI_CARD3_TEXT`, `AI_COL3_TEXT`, `AI_COLUMN3_TEXT`

### `closing_end`

PowerPoint layout names: `closing_end`, `closing`, `end`, `thank_you`, `yaml__closing_end`

Required placeholders:

- `title` (text): `AI_TITLE`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `message` (text): `AI_MESSAGE`
- `contact` (text): `AI_CONTACT`
- `cta` (text): `AI_CTA`

### `chart_basic`

PowerPoint layout names: `chart_basic`, `chart`, `yaml__chart_basic`

Required placeholders:

- `title` (text): `AI_TITLE`
- `chart` (chart): `AI_CHART`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `caption` (text): `AI_CAPTION`

### `image_caption`

PowerPoint layout names: `image_caption`, `picture_caption`, `picture_with_caption`, `icon_caption`, `yaml__image_caption`

Required placeholders:

- `title` (text): `AI_TITLE`
- `icon` (icon): `AI_ICON`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `caption` (text): `AI_CAPTION`
- `attribution` (text): `AI_ATTRIBUTION`

### `appendix_backup`

PowerPoint layout names: `appendix_backup`, `appendix`, `backup`, `yaml__appendix_backup`

Required placeholders:

- `title` (text): `AI_TITLE`

Optional placeholders:

- `subtitle` (text): `AI_SUBTITLE`
- `body` (text): `AI_BODY`, `AI_APPENDIX_BODY`
- `items` (list): `AI_ITEMS`
- `references` (list): `AI_REFERENCES`
