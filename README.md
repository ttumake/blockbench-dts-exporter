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

## Usage

Build the plugin and use blockbench's "Load Plugin from File" option to load `dist/dts_exporter.js`. The plugin will add a new export option for Torque DTS in the export dialog.