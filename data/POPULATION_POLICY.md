# Country and city selection policy

The geographic seed covers 85 sovereign countries: 50 in Europe and 35 in the Americas. Every country has a `country` row in `locations.csv` and a country index page, including countries with no large city.

City selection uses the real first-level administrative structure available for each country. Depending on the country, this may be a state, province, region, district, canton, federal subject, autonomous community, parish, or another equivalent division. A generated regional page is never left without a city.

## Selection order

Each first-level administrative division contains no more than five city pages.

1. **Standard selection:** include up to the five largest cities with a 2025 urban population of at least 200,000.
2. **Small-region selection:** when a division has no city at or above 200,000, include up to five cities at or above 100,000.
3. **Comparable regional fallback:** when it still has no selected city, include its largest UN city at or above 50,000.
4. **Administrative fallback:** when the UN city table contains no city for that division, include one administrative centre or largest available locality from GeoNames. This last population figure does not have a common reference year and must not be compared directly with the UN 2025 figures.

The `selection_rule` column records which rule selected each city:

- `standard-200k`;
- `small-region-100k`;
- `regional-fallback-50k`;
- `regional-largest-locality`.

The population threshold is an editorial navigation rule, not a statement about where homelessness services exist. A smaller locality may be retained only to prevent its administrative division from being empty.

## Population sources

`UN WUP 2025` refers to the United Nations Department of Economic and Social Affairs, Population Division, *World Urbanization Prospects: The 2025 Revision*, File 21. It uses the Degree of Urbanization method: a spatially consistent city definition based on population size, density, contiguity, population grids, and satellite data. Its city population may differ substantially from a municipal-boundary population.

- [UN World Urbanization Prospects 2025 download centre](https://population.un.org/wup/downloads?tab=Cities)
- [UN World Urbanization Prospects 2025 frequently asked questions](https://population.un.org/wup/faqs)

`GeoNames fallback` refers to the current GeoNames geographical database. It is used for administrative assignment and only as a last-resort population field where the UN table does not provide a qualifying city. GeoNames population reference years vary, so those rows have an empty `population_year`.

- [GeoNames geographical database](https://www.geonames.org/)
- [GeoNames data download and field documentation](https://download.geonames.org/export/dump/)

## CSV record types

`locations.csv` contains two types of rows:

- `country`: one row for every country in scope, with the city and region fields empty;
- `city`: one row for every selected city or regional fallback.

`page_status` is `verified` only when a city page already contains reviewed local services. Generated pages use `draft`, include `noindex`, and must not be treated as service directories until a contributor researches and reviews them.

## Draft pages

Draft pages exist so a contributor can open or download the exact city file, replace the draft notice with the city template, and add verified local information. Before changing `page_status` to `verified`, work through `CITY_RESEARCH_CHECKLIST.md`, add sources and verification dates, and remove the generated draft marker.

Country and regional index pages are navigation scaffolds. Their existence does not mean that the linked city pages already contain emergency or support information.
