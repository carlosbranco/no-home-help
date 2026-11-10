# Contributing to No Home Help

Thank you for helping keep practical information available to people who may need it urgently.

- Website: [nohomehelp.com](https://nohomehelp.com/)
- Repository: [github.com/carlosbranco/no-home-help](https://github.com/carlosbranco/no-home-help)
- Issues: [report incorrect information or discuss a change](https://github.com/carlosbranco/no-home-help/issues)

## The simple workflow

1. Fork the repository.
2. Copy the [`city page template`](templates/city.html) or an existing page in the same local language.
3. Add or correct verified information.
4. Test every internal link and phone number.
5. Submit a Pull Request.

You only need a text editor and a web browser.

## Required design and code rules

These requirements apply to every contribution:

- Use static, semantic HTML5 and the existing shared `style.css`.
- Do not add JavaScript, inline event handlers, frameworks, package managers, or build tools.
- Do not add cookies, sessions, local storage, tracking, analytics, advertising, accounts, or personal-data collection.
- Do not add images, SVG files, decorative icons, video, audio, or emojis.
- Do not add external fonts, icon fonts, CDNs, widgets, embeds, iframes, or other dependencies.
- Use relative links for internal navigation.
- Keep the design mobile-first, single-column, compact, and readable at narrow widths.
- Preserve the white background, black text, blue underlined links, system fonts, and approximately 750-pixel maximum content width.
- Do not add cards, shadows, rounded corners, gradients, animations, hero sections, or decorative layout elements.
- Make the page readable with CSS disabled, printable, and useful when the HTML file is saved offline.

The project must remain extremely lightweight. A design change that makes a page larger or more complex needs a clear accessibility or practical-information benefit.

## Language

Write a page in the principal local language of the country or city it covers. Set `<html lang="...">` correctly. Keep official organization names unchanged unless the organization publishes a translated name.

## Add a new country

1. Create a lowercase ASCII country directory, such as `france/` or `brasil/`.
2. Add the country's `index.html` in its principal local language.
3. List its states, provinces, regions, districts, territories, or islands using the country's real administrative structure.
4. Add the country to the main [`index.html`](index.html), including `hreflang` when appropriate.
5. Add the initial geographic rows to [`data/locations.csv`](data/locations.csv).
6. Add verified pages, or use the standard generated draft scaffold with `noindex` when the page is being reserved for contribution. Never present a draft as a completed help directory.

Use [`portugal/index.html`](portugal/index.html) as a reference for a country organized by mainland districts and autonomous island regions. Use [`usa/index.html`](usa/index.html) as a reference for a country organized by states.

## Add a state, province, region, or district

1. Create a lowercase ASCII directory below the country directory.
2. Add an `index.html` in the local language.
3. List the principal cities or localities.
4. Link verified city pages and clearly marked generated draft pages.
5. A draft page must retain its `noindex` tag, generated marker, and contribution links until verified local information replaces the scaffold.

## Add a city

1. Open the existing draft city page, or copy [`templates/city.html`](templates/city.html) into the correct regional directory when no page exists.
2. Rename the file with a lowercase ASCII slug, such as `porto.html` or `los-angeles.html`.
3. Set the correct page title, description, language, breadcrumb, and relative CSS path.
4. Put emergency numbers and instructions first.
5. Add a vertical contents list linking to sections on the same page.
6. Work through the [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md) and record the result for every category before deciding what belongs on the public page.
7. Use only the relevant categories described in the [README category guide](README.md#city-resource-categories).
8. Add each resource in the template's compact format: name, readable address, telephone number, services, hours, eligibility, verification date, and official links.
9. Link the completed city page from its region page.
10. Add or update the corresponding row in `data/locations.csv`.
11. Open the page in a browser and complete the checklist below.

For an existing draft page, replace the scaffold rather than adding a second city file. Remove its `noindex` meta tag and generated draft marker only after the page contains verified emergency and local resource information. Then change `page_status` in `data/locations.csv` from `draft` to `verified`.

## Source and accuracy rules

- Prefer official government and organization websites.
- Include relevant official government support and benefits links even when the page also lists charities or local organizations.
- Show the source with an `Official website` or `Official information` link.
- Record `Last verified: YYYY-MM-DD` on the page and on each resource when practical.
- Call an organization when its official page is unclear.
- Never promise a bed, appointment, benefit, job, or eligibility decision.
- Say whether a location is an intake center, shelter, drop-in center, or administrative office.
- Disclose eligibility restrictions, referral requirements, costs, and religious participation requirements.
- Do not publish confidential domestic-violence shelter addresses.
- Omit a category when no reliable information is available.
- Do not copy services from another city merely to fill a section.
- For a major city, do not stop after finding the first usable result. Look for several independently verified options in shelters, food, religious help, health, and other high-need categories.

## Resource categories

The standard categories and their intended content are explained in the [README category guide](README.md#city-resource-categories). Emergency shelters come first, followed by free food and churches or religious organizations. Include later categories only when useful, verified local information exists.

## City page checklist

- Emergency numbers appear first.
- Breadcrumbs and all internal links are relative.
- The contents list uses normal HTML anchors.
- Addresses and phone numbers appear as readable text.
- Phone numbers also use `tel:` links.
- Directions links are clearly labelled.
- The information-change notice is present.
- The page works with CSS disabled and at a narrow mobile width.
- The page prints clearly.
- There is no JavaScript, cookie, image, SVG, emoji, external font, embed, or external dependency.
- Emergency shelters, food, and religious help appear near the beginning when verified information exists.
- Empty categories have been removed.

## Location CSV

Keep `data/locations.csv` encoded as UTF-8 and preserve its header. A `country` row represents a country; a `city` row represents a selected city. Use lowercase ASCII slugs separated with hyphens. Keep no more than five cities per first-level administrative division and follow the thresholds, regional fallback rules, population sources, and status definitions in [`data/POPULATION_POLICY.md`](data/POPULATION_POLICY.md). Explain significant additions, removals, or replacements in the Pull Request.

All Pull Requests require review before merging.

