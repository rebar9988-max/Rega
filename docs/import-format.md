# Bulk import of businesses (CSV)

Admins and moderators (permission `business.publish`) can import businesses in the dashboard under **/dr/import**.
Every imported row becomes a listing with status **`pending`** — nothing is published automatically, and no location is
marked as confirmed, so a moderator still reviews each listing (and confirms its map position) before it goes live.

* Template (headers only): [`docs/import-sample.csv`](import-sample.csv), also downloadable at `/import-sample.csv`.
* Encoding UTF-8; delimiter `,` or `;` (detected from the header line); values with commas/line breaks in `"quotes"`.
* At most **500 rows** and **1 MB** per upload. Use **Validate only** first: it checks every row and saves nothing.
* Running a file twice is safe: a row whose **name and address** already exist is skipped.
* Cities are never created by an import — they must already exist (admin: *Geography*). Unknown cities or categories
  make that row an error; other rows are still imported.

## Columns

Required columns are marked **bold**; all others are optional (leave empty).

| Column | Meaning |
| --- | --- |
| **`name`** | Business name (2–200 characters) |
| `nameCkb` | Name in Kurdish Sorani script |
| **`category`** | A category `key`/slug (e.g. `legal`, `food`, `tax-accounting`) or its name in any language |
| `description` | Main description |
| `descriptionCkb`, `descriptionKmr`, `descriptionDe`, `descriptionAr`, `descriptionTr`, `descriptionEn`, `descriptionFa` | Description per language |
| `phone`, `email`, `website` | Contact (`website` must be an `http(s)` URL) |
| **`addressLine1`** | Street and house number |
| `postalCode` | Postal code |
| **`city`** | An existing city: slug (`koeln`) or name in any language (`Köln`, `Cologne`) |
| **`countryCode`** | ISO 3166-1 alpha-2 code, e.g. `DE` |
| `latitude`, `longitude` | Both or none; WGS84 decimal degrees. Not treated as confirmed |
| `languages` | Languages spoken, locale codes separated by `;` or space, e.g. `ckb;de;en` |
| `hours_mon` … `hours_sun` | Opening hours of the day, e.g. `09:00–17:00` or `closed` |

## Example (one row)

```csv
name,category,addressLine1,postalCode,city,countryCode,phone,languages
"Example Tax Office",tax-accounting,"Hauptstraße 1",50667,Köln,DE,"+49 221 0000000",ckb;de
```

The example is illustrative only. Never import invented businesses.
