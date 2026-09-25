# Data sources and licensing

DollarOne is designed to enrich Mexican location strings using public/open government data.

## Planned production sources

1. **datos.gob.mx — Catálogo de municipios**
   - URL: https://www.datos.gob.mx/dataset/catalogo_municipios
   - License shown by the portal: Creative Commons Attribution 4.0
   - Purpose: nationwide state/municipality normalization and government codes.

2. **datos.gob.mx / other compatible open territorial catalogs**
   - Used only when the dataset license permits commercial reuse.

## Important SEPOMEX note

Correos de México provides a national postal-code download, but its download page states that commercialization of the national catalog, in whole or in part, is not permitted. DollarOne will therefore **not** resell that raw national catalog. If postal-code enrichment is added, it must use a dataset/license that explicitly permits the intended reuse or a separately licensed provider.

## MVP

The first x402 MVP ships with a small deterministic seed solely to validate:
- payment flow,
- API contract,
- Bazaar discovery,
- Challenge eligibility,
- resolver behavior.

Nationwide coverage is the next data-engineering step.
