# Edit a city

You only need to add or correct entries inside the fixed categories. You do not need to write HTML or change the category structure.

## Correct an existing entry on GitHub

1. Open the city under [`data/cities/`](data/cities/).
2. Select the **Edit this file** pencil button.
3. Find the entry by its `title`.
4. Correct the information and update `last_verified` using `YYYY-MM-DD`.
5. Select **Commit changes** and open a Pull Request.

GitHub checks the file automatically. A maintainer can help fix a comma or another formatting mistake.

## Add an entry

Find the appropriate category and add a new object inside its `entries` list:

```json
{
  "id": "uapsa-lisboa",
  "title": "UAPSA Lisboa",
  "description": "Social assessment and referral for people experiencing homelessness.",
  "last_verified": "2026-11-23",
  "address": "Cais do Gás, Lisboa",
  "phone": "+351 213 220 860",
  "website": "https://example.org/service",
  "hours": "24 hours",
  "how_to_access": "Call first to confirm the current access process."
}
```

Every entry always has the same nine fields.

| Field | What to enter |
| --- | --- |
| `id` | A short stable identifier using lowercase letters, numbers, and hyphens. |
| `title` | Official name of the service or organization. |
| `description` | What it provides, who it helps, costs, documents, and restrictions. |
| `last_verified` | The date the information was checked: `YYYY-MM-DD`. |
| `address` | Public address or service area. Leave empty if unavailable or confidential. |
| `phone` | Main telephone number. Leave empty if unavailable. |
| `website` | Exact official service page beginning with `https://`. Leave empty if unavailable. |
| `hours` | Published opening hours. Leave empty if unknown. |
| `how_to_access` | Whether to call, walk in, book, or obtain a referral. Leave empty if unknown. |

Use an empty string for unavailable optional information:

```json
"address": "",
"phone": "",
"website": "",
"hours": "",
"how_to_access": ""
```

The generator hides empty fields. It also creates telephone links, website links, the report link, menus, and HTML automatically.

## Fixed categories

Every city already contains the same categories in the correct order. Add entries to the closest category and do not create a new category. Categories with no entries remain invisible on the public site.

The categories cover emergency help, shelter, food, community and religious help, hygiene, clothing, health, mental health, public facilities, internet, transport, benefits, employment, legal aid, documents, mail, storage, safety, specialist support, veterans, pets, and other useful resources.

## When is a city ready to publish?

A page is not complete merely because it has one emergency number and one shelter. A useful guide needs several independent routes to help, especially because shelters can be full and eligibility differs.

The content-depth report scales the minimum expectations by population:

| City population | Resources | Filled categories | Shelter or housing routes | Independent source domains |
| --- | ---: | ---: | ---: | ---: |
| 1,000,000 or more | 20 | 10 | 3 | 8 |
| 500,000–999,999 | 16 | 8 | 3 | 7 |
| 200,000–499,999 | 12 | 7 | 2 | 6 |
| Under 200,000 | 8 | 5 | 1 | 4 |

Every published city should also cover emergency referral, shelter or housing access, food, health or mental-health care, benefits or another local social-support route, and employment support when the population is 200,000 or more. These are minimums, not targets: a large city should normally contain more.

Run `npm run report:content` to see the backlog. Run `npm run check:content` when you want the command to fail until every published city reaches the minimum.

## Add a new city

1. Copy [`templates/city.json`](templates/city.json).
2. Save it as `data/cities/<country>/<region>/<city>.json`.
3. Keep `"status": "draft"` while researching.
4. Fill the location and page text in the local language.
5. Translate the prefilled category titles into that language. Do not change their IDs or order.
6. Replace the example entry and add verified services.
7. Follow [`CITY_RESEARCH_CHECKLIST.md`](CITY_RESEARCH_CHECKLIST.md).
8. Add the city to [`data/locations.csv`](data/locations.csv).

Do not edit generated `.html` files.

## Accuracy rules

- Prefer official government and organization pages.
- Verify that the service still exists.
- State whether access is walk-in, appointment-only, referral-only, or outreach.
- Never promise a bed, meal, appointment, benefit, treatment, or job.
- Never publish a confidential domestic-violence shelter address.
- If hours are unknown, leave `hours` empty and tell the reader to confirm before travelling.
- Remove a closed service when no replacement is confirmed.

## Check locally

```sh
npm run generate
npm run check
```

If you edit through GitHub and cannot run these commands, open the Pull Request anyway. The automatic checks and maintainers will help.

