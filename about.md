# Torque DTS Exporter

Blockbench plugin for exporting models to Torque DTS.

## Features

- Static DTS export
- Color swatch material export
- Atlas texture export
- Helper node export
- Mesh object export
- Basic animation sequence export
- Optional LOD export with `detailNN` groups

## Notes

- The plugin currently targets DTS 24 by default.
- If no `detailNN` groups are present, it falls back to a single default detail level.
- Materials, sequences, and LODs can be inspected in the export dialog before writing files.
