# No Home Help

No Home Help is a free, international directory of practical services for people experiencing homelessness. It is designed to put urgent, locally verified information in front of someone quickly, including on an old phone or a slow connection.

- Official website: [nohomehelp.com](https://nohomehelp.com/)
- Repository: [github.com/carlosbranco/no-home-help](https://github.com/carlosbranco/no-home-help)
- Report incorrect information: [open a GitHub issue](https://github.com/carlosbranco/no-home-help/issues/new?template=incorrect-information.md)

The public website is static, lightweight, privacy-respecting, and open source. City content lives in JSON; HTML pages and navigation indexes are generated from that data.

## How the site works

The universal data contract is [`schemas/city.schema.json`](schemas/city.schema.json). Every country and language uses the same fields. Public-facing content is written in the guide's local language, while stable technical keys remain in English.

All city files contain the same fixed categories. Every service uses the same simple fields: title, description, verification date, address, phone, website, hours, and access instructions. Empty fields and categories are hidden automatically.

```text
data/cities/<country>/<region>/<city>.json
                         └───────┬───────┘
                                 │ npm run generate
                                 ▼
             <country>/<region>/<city>.html
```

Only `published` JSON files create pages or appear in indexes. Empty categories are hidden. Drafts remain in the repository for contributors but are absent from the public site.

Each resource has a `last_verified` date and its own link for reporting incorrect information. That report opens a prefilled GitHub issue containing the exact JSON file and `category/entry` identifier.

## Multiple languages for one city

The primary file uses the city's principal local language:

```text
data/cities/portugal/lisboa/lisboa.json
```

Translations sit beside it with a language suffix:

```text
data/cities/portugal/lisboa/lisboa.en.json
data/cities/portugal/lisboa/lisboa.es.json
```

The generator creates `lisboa.html`, `lisboa.en.html`, and `lisboa.es.html`, and adds `hreflang`, canonical URLs, and links between the available versions. The primary JSON has `"primary": true`; translations have `"primary": false`.

Read [`data/cities/README.md`](data/cities/README.md) for the complete naming and editing rules.

## Add or edit a city

First-time contributors should start with [`EDIT_CITY_JSON.md`](EDIT_CITY_JSON.md). It explains every field in the model and includes a no-install workflow for proposing a correction directly through GitHub.

1. Copy [`templates/city.json`](templates/city.json).
2. Place it in the correct country and region folders.
3. Keep `status` as `draft` while researching.
4. Work through [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md).
5. Add real sources and a verification date for every entry.
6. Change the JSON to `published` and the corresponding CSV row to `verified`.
7. Run `npm run generate` and `npm run check`.

Generated HTML must not be edited directly. To change the design or semantic layout for every page, edit the files in `templates/` and regenerate.

## Repository structure

```text
.
├── data/
│   ├── cities/
│   │   └── country/region/city.json
│   ├── locations.csv
│   └── POPULATION_POLICY.md
├── schemas/
│   └── city.schema.json
├── scripts/
│   ├── generate-site.mjs
│   └── check-data.mjs
├── templates/
│   ├── city.json
│   ├── city.html
│   ├── country.html
│   ├── region.html
│   └── index.html
├── style.css
└── generated country and city HTML
```

## Commands

Node.js 20 or newer is required only for contributors and CI. The published website itself has no runtime or client-side dependency.

```sh
npm run generate
npm run check
npm run check:external
```

- `generate` validates JSON, regenerates all published pages and indexes, and removes only marked legacy draft scaffolds.
- `check` confirms generated HTML is current and checks city references, dates, phone links, and CSV synchronization.
- `check:external` checks external links; it is intended for the monthly CI job because remote sites can be temporarily unavailable.

No package installation is required; the scripts use only built-in Node.js modules.

## Public-site rules

The generated site must remain:

- static semantic HTML5 with one shared CSS file;
- free of client-side JavaScript, cookies, storage, tracking, analytics, and advertising;
- free of images, video, audio, SVG decoration, emojis, external fonts, CDNs, embeds, and iframes;
- mobile-first, single-column, readable with CSS disabled, and useful when saved offline;
- based on system fonts, a white background, black text, and normal blue underlined links;
- compact, accessible, and suitable for printing.

Build-time Node scripts are allowed only to validate data and generate these static files. Do not add a browser runtime, framework, dependency bundle, or remote asset.

## Content and safety rules

- Put emergency instructions and tonight's shelter path first.
- Prefer official government and organization sources.
- Include official government support and benefits links when available; charities complement them rather than replace them.
- Never invent a service, address, phone number, time, fare, eligibility rule, or availability.
- Never guarantee a bed, meal, appointment, benefit, treatment, or job.
- Do not publish confidential shelter addresses.
- Omit categories with no reliable local information.
- Major cities should normally have several independently verified choices in shelter, food, religious help, health, and social support.
- A smaller locality may contain fewer entries or a clearly explained route to the nearest regional service.

The complete category-by-category standard is in [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md).

## Location registry

[`data/locations.csv`](data/locations.csv) is the geographic and publication registry. It contains countries and selected cities, language, administrative division, population source, selection rule, and page status.

Each first-level administrative division has no more than five selected cities. The normal population threshold is 200,000. A smaller division may use 100,000, and one smaller regional centre can be retained when needed so the division is not empty. See [`data/POPULATION_POLICY.md`](data/POPULATION_POLICY.md).

## License

This project is released under the [MIT License](LICENSE).
