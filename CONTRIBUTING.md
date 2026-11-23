# Contributing to No Home Help

Thank you for helping keep urgent practical information accurate and accessible.

- Website: [nohomehelp.com](https://nohomehelp.com/)
- Repository: [github.com/carlosbranco/no-home-help](https://github.com/carlosbranco/no-home-help)
- Issues: [report or discuss a change](https://github.com/carlosbranco/no-home-help/issues)

## Simple workflow

1. Fork the repository.
2. Copy [`templates/city.json`](templates/city.json), or edit an existing file under `data/cities/`.
3. Research and verify the information.
4. Run `npm run generate`.
5. Run `npm run check`.
6. Submit a Pull Request containing the JSON, generated HTML, and any necessary CSV change.

Do not edit generated city HTML or generated indexes directly. The generator will replace those changes.

## Add a city

1. Use the path `data/cities/<country>/<region>/<city>.json` with lowercase ASCII slugs.
2. Copy the universal [`templates/city.json`](templates/city.json).
3. Set the correct location, language, text direction, title, and description.
4. Use `"primary": true` for the city's principal local-language file.
5. Keep `"status": "draft"` while the guide is incomplete. Drafts do not appear on the site.
6. Put emergency numbers and the first step for tonight at the beginning.
7. Complete the [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md).
8. Add only categories with reliable local information.
9. Give every resource a stable slug ID and `last_verified` date.
10. Add or update the city in `data/locations.csv` and follow [`data/POPULATION_POLICY.md`](data/POPULATION_POLICY.md).
11. Change both the JSON status to `published` and the CSV page status to `verified` when the guide is ready.

The generator automatically creates the city page, country index, region index, contents list, report links, and navigation.

## Add a translation

Keep the same country, region, city, category, and entry identifiers. Add the lowercase language tag to the filename:

```text
lisboa.json       primary European Portuguese
lisboa.en.json    English translation
lisboa.es.json    Spanish translation
```

Set `locale.language` to its BCP 47 tag and `locale.primary` to `false`. Translate all public-facing text accurately, but do not translate official organization names unless the organization publishes that name. There must be exactly one published primary file for each city.

## Edit the site design

Generated pages use the HTML files in `templates/` and the shared `style.css`. Edit those files and run `npm run generate` to apply a layout change everywhere.

Public output must have:

- no client-side JavaScript or event handlers;
- no cookies, browser storage, tracking, analytics, advertising, accounts, or personal-data collection;
- no images, decorative SVG, emoji, video, audio, external fonts, CDNs, widgets, embeds, or iframes;
- static semantic HTML and relative internal navigation;
- a compact mobile-first single column that remains readable with CSS disabled and when printed;
- no cards, shadows, rounded corners, gradients, animations, or decorative hero sections.

Build-time Node scripts are allowed for generation and validation. Do not add a client framework or runtime dependency.

## Source and accuracy rules

- Prefer official government and organization websites.
- Include relevant official government support and benefits links.
- Record `last_verified` as `YYYY-MM-DD` on every resource.
- Include source links in the entry itself.
- Call or email the organization when official information is unclear, when practical.
- Never promise a bed, appointment, benefit, treatment, job, or eligibility decision.
- Distinguish intake, shelter, drop-in, outreach, referral-only, and administrative services.
- State eligibility, costs, required documents, religious participation, and access restrictions when known.
- Do not publish confidential domestic-violence shelter addresses.
- Do not copy services from another city to fill a category.
- Omit an empty or unverified category; the generator also hides empty categories.

## JSON guidance

Use a plain string for ordinary text:

```json
{
  "type": "paragraph",
  "content": "Call before travelling because hours can change."
}
```

Use inline segments only when text needs a link, emphasis, bold text, or a line break:

```json
{
  "type": "paragraph",
  "content": [
    { "text": "Phone: ", "strong": true },
    { "text": "+351 000 000 000", "href": "tel:+351000000000" }
  ]
}
```

Resource IDs need only be unique inside their category. The full stable reference is `category-id/resource-id`. See [`data/cities/README.md`](data/cities/README.md) and [`schemas/city.schema.json`](schemas/city.schema.json).

## Before opening a Pull Request

- `npm run generate` completes successfully.
- `npm run check` completes successfully.
- Emergency instructions are first.
- Dates, telephone links, internal anchors, and source links are correct.
- The page language and text direction are correct.
- The guide contains no invented information or confidential address.
- The generated page is readable on a narrow screen and with CSS disabled.

All Pull Requests require review before merging.
