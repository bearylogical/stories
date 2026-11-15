# postal-sg ships its points as a compact binary file, not GeoJSON

The postal code points were a 72 MB GeoJSON file, downloaded in full before the first Step. They now ship as a packed binary file (postal code as `Uint32`, longitude and latitude as `Float32`, about 12 bytes per point), which the worker loads and filters across the whole island. Address text sits in separate per-sector files, fetched only when zoomed into buildings or in the Explorer. The target is under 3 MB before the first Step.

## Considered Options

- **PMTiles vector tiles**: render faster, but counting matches and filtering across all of Singapore would still need a separate index.
- **Trimmed GeoJSON**: simplest, but still 10–15 MB.

## Update: format 2 (points.v2.bin)

Format 1 was 1.70 MB raw. Cloudflare compresses it on the fly at a low Brotli level, so readers downloaded 775 KB. Format 2 stores each code as the gap from the one before (a varint), and each coordinate as a 16-bit step across the island's bounding box, written as the change from the point before in separate high-byte and low-byte planes. Published as points.v2.bin: 693 KB raw, 330 KB as Cloudflare serves it with Brotli. Codes are exact; positions are within 1 m of the source (0.88 m at most). The reader still reads format 1. See `src/lib/data/postal-points.js` for the layout.
