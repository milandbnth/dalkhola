# Dalkhola Online — Services data processor patch

This patch processes the four existing Apify exports into the Services module. It is designed for static GitHub Pages deployment: Python runs locally or in GitHub Actions, and the browser only reads published JSON.

## Important preservation rules

- Raw Apify files are read-only; the processor never rewrites them.
- Accepted Google Places record objects are copied unchanged. Original fields such as `title`, `categoryName`, `address`, `location`, `phone`, `openingHours`, `placeId`, `url`, and `imageUrl` remain as supplied.
- The generated JSON adds category arrays and metadata around those unchanged objects.
- No Apify token is needed to process the already-downloaded files.
- The existing Business collector is not touched.

## Files expected in the repository

```text
data/raw/apify/services/latest.json       # Banking export (62 raw records)
data/raw/apify/services/hotels.json      # Hotels export (47 raw records)
data/raw/apify/services/diagnostics.json # Diagnostics export (64 raw records)
data/raw/apify/services/pharmacies.json  # Pharmacies export (102 raw records)
```

The raw files must be top-level JSON arrays, as exported by Apify. Do not wrap them in another object or rename their fields.

## Install this patch

Copy these patch files into the matching paths in the project root:

- `scripts/services/process_services_data.py`
- `scripts/services/migrate_manual_services.py`

The generated files included in this archive are examples from the four supplied exports. Regenerate them after copying the scripts and raw inputs into your repository.

## Step 1 — Preview the manual banking migration

The current manual Services JSON contains 3 curated banking records (`DLK-SRV-000004` through `DLK-SRV-000006`) plus `city_summary`. To keep the manual module focused on Healthcare, Municipality and Post Office, preview the migration:

```bash
python scripts/services/migrate_manual_services.py --dry-run
```

If the preview is correct, apply it:

```bash
python scripts/services/migrate_manual_services.py --apply
```

The script creates a timestamped backup of `manual/content.json`, copies the 3 curated bank records unchanged to `automated/curated_banking.json`, and removes only the `banking` and duplicate `city_summary` keys from the manual file. Existing IDs and bank details are retained. This migration is opt-in; dry-run makes no changes.

## Step 2 — Build automated data

```bash
python scripts/services/process_services_data.py
```

Output:

```text
data/modules/services/automated/content.json
reports/services-data-audit.json
```

The generated automated JSON contains `banking`, `hotels`, `diagnostics`, `pharmacies`, and `curated_banking` arrays. The first four contain unchanged Google Places objects; `curated_banking` contains the existing manual bank records unchanged after migration.

## Filtering policy

- Banking: banks, ATMs, public-sector banks, financial institutions, loan agencies, money-transfer services and financial consultants. Unrelated internet cafes, post offices, Aadhaar centres, shops and offices are excluded.
- Hotels: hotels, lodges and guest houses. Restaurants, warehouses, gyms and shops are excluded.
- Diagnostics & Clinics: diagnostic centres, imaging centres, pathology/labs, clinics, dental clinics, hospitals and related care centres. Standalone doctor profiles and pharmacy-only listings are excluded.
- Pharmacies: pharmacies, drug stores, homeopathic pharmacies, medical-supply stores, and Medical Center listings whose names clearly identify a medical hall/store/agency/chemist/pharmacy.
- Permanently closed listings are excluded. Temporarily closed listings are retained with their original `temporarilyClosed` field so the page can label them.
- Nearby settlements are included within 12 km of the Dalkhola reference point; municipal boundary membership is not required. Records explicitly labelled Alipurduar are excluded even if their coordinates appear local.
- Duplicates are removed by Google `placeId`, with normalized name + address as fallback.

## Counts from the supplied exports

The current processor produced 218 Google Places records:

| Category | Included |
|---|---:|
| Banking | 46 |
| Hotels & lodging | 37 |
| Diagnostics & clinics | 50 |
| Pharmacies | 85 |
| **Total** | **218** |

The 3 curated manual bank records are additional after migration.

## Important next frontend step

The processor does not modify `services.html` or `page-renderer.js`. The current live renderer must be checked before wiring the new category arrays into the page. In particular, render each of the four automated categories as an expandable category card and keep the four manual cards full-width and always expanded. Do not display Transport on the Services page. A Police Station record was not present in the supplied manual data, so its card must remain an honest “details pending verification” placeholder until verified details are supplied.

## GitHub Pages compatibility

This processor runs before deployment. Commit the generated static JSON and have the existing publisher copy it into `public/data/...` according to the project's module registry. No runtime API key or server is required by the published site.
