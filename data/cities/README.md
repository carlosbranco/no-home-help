# Universal city JSON format

Every public city guide is generated from JSON. Do not edit a generated city HTML file by hand.

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
5. Add only verified resources. Each resource needs its own `last_verified` date.
6. Use plain strings for normal text. Use inline segment arrays only for links, bold text, emphasis, or line breaks.
7. Point `quick_actions` at the most useful resource IDs for tonight, this week, and this month.
8. Change `status` to `published`, update `data/locations.csv`, and run `npm run generate`.
9. Run `npm run check` before opening a pull request.

Empty categories are not rendered. A draft JSON does not create a public page or appear in an index.

## Stable identifiers

Category and resource IDs use lowercase ASCII slugs. A resource ID only needs to be unique inside its category. A complete entry reference is therefore:

```text
category-id/resource-id
```

The same reference is used by `quick_actions`, HTML anchors, and the prefilled GitHub issue link shown on every resource.

## Templates and schema

- [`schemas/city.schema.json`](../../schemas/city.schema.json) is the universal machine-readable contract.
- [`templates/city.json`](../../templates/city.json) is the contributor model.
- `templates/*.html` control the generated page layout.
- `scripts/generate-site.mjs` validates the data and regenerates all public HTML.

Changing an HTML template and running the generator updates every affected page without changing city data.
