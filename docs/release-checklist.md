# Release Checklist

## 1. Quality gate

```bash
npm ci
npm run quality:check
```

## 2. Security gate

```bash
npm run security:all
```

## 3. Documentation gate

- `README.md` updated
- `docs/` updated
- `CHANGELOG.md` updated

## 4. Versioning

- Update package version in `package.json`
- Tag release commit after merge to `main`

## 5. Publish

```bash
npm publish --access public
```

## 6. Post-release verification

```bash
npm view pptx-parser-for-ai version
npm view pptx-parser-for-ai dist-tags
```
