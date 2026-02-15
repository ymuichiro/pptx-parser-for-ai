# Example Usage

## Run individual examples

```bash
npx tsx example/basic/generate.ts
npx tsx example/network/generate.ts
```

## Run template import example

```bash
npx tsx example/template-import/import.ts ./input/company-template.potx ./templates/company
npx tsx example/template-import/generate-with-template.ts ./templates/company/template.yaml ./output/template-applied.pptx
```

## Run example verification

```bash
npm run example:test
```
