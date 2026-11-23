# Universal city JSON format

Every public city guide is generated from JSON. Do not edit a generated city HTML file by hand.

For a field-by-field explanation, copyable examples, verification rules, and instructions for editing directly on GitHub, read [`EDIT_CITY_JSON.md`](../../EDIT_CITY_JSON.md). Keep that guide open beside [`templates/city.json`](../../templates/city.json) while filling a city.

## File paths and languages

Store the primary local-language file at:

```text
data/cities/<country>/<region>/<city>.json
```

Store translations beside it, using a lowercase BCP 47 language suffix:

```text
data/cities/portugal/lisboa/lisboa.json
data/cities/portugal/lisboa/lisboa.en.json
data/cities/portugal/lisboa/lisboa.es.json
```

The generator creates the matching pages:

```text
portugal/lisboa/lisboa.html
portugal/lisboa/lisboa.en.html
portugal/lisboa/lisboa.es.html
```

The primary file uses `"primary": true`. Every translation uses `"primary": false`. There must be exactly one published primary file per city. The country, region, and city folders make the location unique, even when cities in different places share a name.

## Add or edit a guide

1. Copy [`templates/city.json`](../../templates/city.json).
2. Put it in the correct country and region folders.
3. Keep `status` as `draft` while researching.
4. Write public-facing text in the guide's `locale.language`.
5. Add verified services to the prefilled category `entries` arrays. Each entry always uses the same nine fields and needs its own `last_verified` date.
6. Leave optional fields as empty strings when the information is unavailable. The generator hides them.
7. Change `status` to `published`, update `data/locations.csv`, and run `npm run generate`.
8. Run `npm run check` before opening a pull request.

Do not add, remove, or reorder categories. Empty category `entries` arrays are not rendered. A draft JSON does not create a public page or appear in an index.

## Stable identifiers

Category and entry IDs use lowercase ASCII slugs. An entry ID only needs to be unique inside its category. A complete entry reference is therefore:

```text
category-id/entry-id
```

The same reference is used by HTML anchors and the prefilled GitHub issue link shown on every entry.

## Templates and schema

- [`schemas/city.schema.json`](../../schemas/city.schema.json) is the universal machine-readable contract.
- [`templates/city.json`](../../templates/city.json) is the contributor model.
- `templates/*.html` control the generated page layout.
- `scripts/generate-site.mjs` validates the data and regenerates all public HTML.

Changing an HTML template and running the generator updates every affected page without changing city data.
