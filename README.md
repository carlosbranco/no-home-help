# No Home Help

No Home Help is a free, international directory of practical services for people experiencing homelessness. The priority is to help someone find essential information in less than 30 seconds, including on an old phone or a slow connection.

- Official website: [nohomehelp.org](https://nohomehelp.org/)
- Official repository: [github.com/carlosbranco/no-home-help](https://github.com/carlosbranco/no-home-help)
- Report incorrect information: [open a GitHub issue](https://github.com/carlosbranco/no-home-help/issues/new?template=incorrect-information.md)

The project is humanitarian, open source, privacy-respecting, and community-maintained. It is not a commercial product.

## Non-negotiable technical rules

Every page and contribution must follow these rules:

- static, semantic HTML5 only;
- one small shared CSS file: [`style.css`](style.css);
- no JavaScript, including inline scripts or event handlers;
- no frameworks, package managers, build tools, or generated bundles;
- no databases, registration, accounts, forms that collect personal data, or location permissions;
- no cookies, sessions, local storage, tracking, analytics, or advertising;
- no external dependencies, CDNs, embedded widgets, or iframes;
- no external fonts or icon fonts; use system fonts only;
- no images, SVG files, decorative icons, videos, or audio;
- no emojis in page content, navigation, headings, or contributor documentation;
- relative internal links, so the site works in a GitHub subdirectory or from saved files;
- pages must remain readable with CSS disabled and when saved for offline use;
- pages must be suitable for printing and saving as PDF.

Do not add a tool or asset merely because it is convenient. The absence of JavaScript, images, external fonts, cookies, and dependencies is a core project requirement.

## Design rules

No Home Help deliberately looks like a compact, traditional internet directory. It must not look like a modern startup landing page.

- white background;
- black text;
- blue, underlined links;
- Arial, Helvetica, or another system sans-serif font;
- mobile-first, single-column content;
- maximum content width of approximately 750 pixels;
- readable text sizes and compact vertical spacing;
- normal headings, paragraphs, and HTML lists;
- emergency information before all other content;
- vertical contents lists with same-page anchor links;
- no cards, columns that are difficult to read on mobile, shadows, rounded corners, gradients, animations, or decorative whitespace;
- no large hero sections, banners, illustrations, or purely decorative content.

The design goal is speed, clarity, accessibility, and information density. A visitor in urgent need should see useful telephone numbers and instructions immediately.

## View the site

Open `index.html` in any web browser. No installation or local server is required.

## Start from the city template

Use the [`templates/city.html`](templates/city.html) file when adding a city. It contains the required semantic structure, emergency block, verification notice, contents list, resource format, relative navigation, and report link.

An existing completed page, [`usa/new-york/new-york-city.html`](usa/new-york/new-york-city.html), can be used as a practical reference. Do not copy its services into another city; every local resource must be independently verified.

Work through the [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md) category by category before publishing. It explains what to search for, what facts to record, and how to document a category that is not available locally. Major cities should normally contain several verified choices in core categories such as shelter, food, religious help, health, and social support.

## Repository structure

```text
.
├── index.html
├── style.css
├── data/
│   ├── locations.csv
│   └── POPULATION_POLICY.md
├── CITY_RESEARCH_CHECKLIST.md
├── country-slug/
│   ├── index.html
│   └── region-slug/
│       ├── index.html
│       └── city-slug.html
└── templates/
    └── city.html
```

## Location data

`data/locations.csv` is a UTF-8 geographic registry for 85 countries in Europe and the Americas. It distinguishes `country` rows from `city` rows and records the language, administrative division, population source, selection rule, and page status.

Each first-level administrative division has no more than five selected cities. The normal threshold is 200,000 inhabitants. A division with no qualifying city may use the 100,000 threshold; if it would still be empty, one smaller regional centre is retained as an explicitly labelled fallback. Read the complete [`data/POPULATION_POLICY.md`](data/POPULATION_POLICY.md) for the source definitions and selection rules.

The list is a navigation and contribution seed, not a claim that services are already available. A `draft` city page contains no verified local help and uses `noindex` until contributors replace the scaffold with researched information.

## Language policy

Country and city pages should use the principal local language of the place they cover. Keep organization names as officially written and translate explanatory text accurately. Set the correct HTML `lang` attribute and add `hreflang` when linking across languages.

Examples:

- pages for the United States are written in English;
- pages for Portugal are written in European Portuguese;
- a new country should use its principal local language unless there is a documented reason to provide more than one language version.

## City resource categories

Add only categories for which reliable local information is available. Never create filler or invent a resource.

| Category | What belongs in it |
| --- | --- |
| Emergency shelters | Instructions for someone with nowhere to sleep tonight; intake centers, placement hotlines, overnight and seasonal shelters. Clearly distinguish walk-in intake from referral-only services and never promise a bed. |
| Free food | Free meals, soup kitchens, food banks, community kitchens, church meal programs, and emergency food assistance, with verified hours when available. |
| Churches and religious organizations | Churches, missions, religious charities, meal programs, clothing, shelter, pastoral care, and other practical help. State the faith tradition and whether religious participation is required. |
| Showers and laundry | Free showers, laundry, hygiene centers, drop-in centers, and hygiene-product distribution. |
| Free clothing | Clothing, coats, shoes, socks, blankets, and clothing suitable for job interviews. |
| Free or low-cost medical care | Clinics, mental health care, dental care, prescriptions, addiction services, and emergency medical instructions. |
| Public toilets | Free and accessible toilets in public facilities, libraries, parks, or transit locations, including verified hours when possible. |
| Phone charging and internet | Public libraries, charging locations, free Wi-Fi, computers, internet access, and telephone services. |
| Free or reduced transportation | Free or discounted transit, charity bus passes, shelter transportation, and other verified travel assistance. |
| Government benefits | Food, cash, health, housing, disability, unemployment, rental, and emergency assistance. Explain eligibility briefly and never guarantee approval. |
| Employment assistance | Job centers, placement, training, résumé and interview help, computer access, and practical guidance for applying without a permanent address. |
| Free legal aid | Housing, eviction, immigration, employment, public-benefit, identification, and other free civil legal help. |
| Documents and identification | Help obtaining or replacing identification cards, birth certificates, driving licences, Social Security documents, or local equivalents. |
| Mailing address | Authorized mail collection, care-of addresses, postal general delivery, and services that receive correspondence for active clients. |
| Storage services | Free or low-cost storage and official allowances for personal belongings. |
| Veterans assistance | Veteran shelters, health care, housing, employment, benefits, and crisis lines. |
| Domestic violence support | Confidential hotlines, safety planning, emergency housing, legal help, and survivor services. Never publish confidential shelter addresses. |
| Help for people with pets | Pet-friendly options, temporary care, food, veterinary help, service-animal rules, and programs intended to keep people and animals together. |
| Airport transportation | The cheapest practical public route from major airports, with official route links, approximate fares, travel guidance, and connections toward the city or intake services. |
| Other useful resources | Libraries, warming and cooling centers, drinking water, outreach teams, community centers, and verified help that does not fit another category. |

Every city page begins with emergency information and a verification date. Categories with no verified information should be omitted rather than published empty.
Include the relevant official government support and benefits links whenever they exist. Charity listings complement public services; they do not replace the official application, eligibility, or emergency information.

## Contributing countries, regions, and cities

Contributions are welcome for the entire directory, including:

- new countries;
- states, provinces, regions, districts, territories, and islands;
- new cities and principal localities;
- shelters, churches, food services, health care, employment help, and other resources;
- corrections, updated hours, translations, and accessibility improvements.

The navigation hierarchy is:

```text
Country -> State, province, region, or district -> City
```

When adding a country, create its directory and `index.html`, write it in the local language, add it to the main country list, and add its geographic seed rows to [`data/locations.csv`](data/locations.csv). When adding a city, copy the [city template](templates/city.html), verify every resource, and link the new page from its region page.

Generated draft city pages can also be edited in place. Replace the draft scaffold with the [city template](templates/city.html), complete the [research checklist](CITY_RESEARCH_CHECKLIST.md), remove `noindex` and the generated draft marker, and change the CSV `page_status` only after the information has been reviewed.

Read the complete [contribution guide](CONTRIBUTING.md) before opening a Pull Request.

## Accuracy and safety

Prefer official government or organization sources. Never invent a service, address, phone number, opening time, fare, eligibility rule, or bed availability. Every city page must show a verification date and warn readers that information can change.

The root [`CNAME`](CNAME) file declares `nohomehelp.org` as the custom domain for GitHub Pages. The domain must also be configured in the repository's Pages settings and in its DNS records.

## License

This project is released under the [MIT License](LICENSE).

