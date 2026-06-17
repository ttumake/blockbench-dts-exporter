# blockbench-dts

Blockbench plugin for exporting models to Torque DTS.

## Current Scope

- Static DTS export
- Color swatch material export
- Atlas texture export
- Mesh object export
- Helper nodes like `muzzlePoint`, `ejectPoint`, `mountPoint`
- Basic animation sequence export
- Optional LOD export using `detailNN` groups

## Build

```bash
npm install
npm run build
```

Output:

- `dist/dts_exporter.js`

## Development

Watch mode:

```bash
npm run watch
```

Main source folders:

- `src/blockbench` Blockbench model/animation collection
- `src/model` exporter intermediate model types and transforms
- `src/dts` DTS writing
- `src/export` export dialog and package building
- `src/util` texture/material helpers

## Notes

- The plugin currently targets DTS 24 by default.
- If no `detailNN` groups are present, export falls back to a single default detail level.
- Reference files and sample assets are in `docs/`.
