# postal-sg ships its points as a compact binary file, not GeoJSON

The postal code points were a 72 MB GeoJSON file, downloaded in full before the first Step. They now ship as a packed binary file (postal code as `Uint32`, longitude and latitude as `Float32`, about 12 bytes per point), which the worker loads and filters across the whole island. Address text sits in separate per-sector files, fetched only when zoomed into buildings or in the Explorer. The target is under 3 MB before the first Step.

## Considered Options

- **PMTiles vector tiles**: render faster, but counting matches and filtering across all of Singapore would still need a separate index.
- **Trimmed GeoJSON**: simplest, but still 10–15 MB.
