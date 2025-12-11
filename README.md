

<div align="center">
<img src=public/Example.png width="100%"/>
</div>

# Nested Notes (React + TypeScript + Vite)

An in-browser nested sticky-note tool with Markdown preview, drag/resize, color picking, autosave to IndexedDB/localStorage, and JSON import/export.

## Running locally

```bash
npm install
npm run dev
```

Building uses Vite: `npm run build`.

## Usage

- Drag notes to reposition; resize from the bottom-right handle.
- Double-click a note to edit. Toggle Markdown preview, font size, weight, and color from the toolbar.
- Notes autosave to IndexedDB/localStorage; you can also manually Save/Load/Restore from the top bar or import/export JSON.
- Right-click a note to add a child.

## Shortcuts and menus

- Escape closes context menus and popovers.
- Right-clicking while a color/text menu is open closes menus instead of opening a new one.

## Tech stack

- React + TypeScript + Vite
- Tailwind styles (via global classes)
- IndexedDB + localStorage persistence
