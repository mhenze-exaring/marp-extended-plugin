# Renaming TODOs: obsidian-marp-plugin → Marp Extended

This document tracks all locations that need to be updated to complete the rename from `obsidian-marp-plugin` to `marp-extended-plugin` / "Marp Extended".

> **IMPORTANT**: Marp Extended must be able to coexist with the original Marp plugin in the same Obsidian vault. This requires unique identifiers for plugin ID, view types, CSS classes, and settings storage.

## Naming Convention

| Context | Old Name | New Name |
|---------|----------|----------|
| Package name (npm) | `obsidian-marp-plugin` | `marp-extended-plugin` ✅ |
| Display name | `Obsidian Marp Plugin` / `Marp` | `Marp Extended` ✅ |
| Directory | `obsidian-marp-plugin` | `marp-extended-plugin` ✅ |
| Plugin ID | `marp` | `marp-extended` ✅ |
| CLI binary | `marp-extended` | `marp-extended` ✅ |

---

## CRITICAL: Coexistence Requirements

These changes are **mandatory** to allow Marp Extended to coexist with the original Marp plugin:

### 1. Plugin ID (manifest.json) ✅ DONE

- [x] **Line 2**: `"id": "marp-extended"`

### 2. View Type Identifier (deckView.ts) ✅ DONE

- [x] **Line 24**: `MARP_DECK_VIEW_TYPE = 'marp-ext-deck-view'`

### 3. Default Theme Directory (settings.ts) - INTENTIONALLY KEPT

- [x] **Line 41**: Kept as `themeDir: 'MarpTheme'` to allow sharing themes with original plugin

### 4. CSS Class Prefixes (deckView.ts) ✅ DONE

All classes updated to `marp-ext-*` prefix:
- [x] `marp-ext-placeholder`, `marp-ext-placeholder-title`, `marp-ext-placeholder-subtitle`
- [x] `marp-ext-active-slide`
- [x] `marp-ext-toolbar-button`
- [x] `marp-ext-search-bar`, `marp-ext-search-input`, `marp-ext-search-results`, `marp-ext-search-btn`
- [x] `marp-ext-search-highlight`, `marp-ext-search-current`
- [x] `marp-ext-deck-wrapper`, `marp-ext-deck-slides`, `marp-ext-deck-toolbar`

### 5. Internal Element IDs (deckView.ts) ✅ DONE

- [x] `__marp-ext-deck-style`
- [x] `__marp-ext-active-slide-style`

---

## Standard Renaming (Non-Critical)

### 6. Package Configuration ✅ DONE

- [x] **package.json**: `"name": "marp-extended-plugin"`

### 7. Package Lock

- [ ] Run `npm install` to regenerate `package-lock.json`

### 8. Plugin Metadata (manifest.json) ✅ DONE

- [x] `"name": "Marp Extended"`
- [x] `"description": "Plugin for using Marp with extended features on Obsidian. Based on JichouP's obsidian-marp-plugin."`
- [x] `"author": "JichouP, Mathias Henze & Claude"`
- [x] `"authorUrl": "https://github.com/mhenze-exaring"`

---

## Documentation Files - TODO

### 9. README.md
- [ ] **Line 1**: Change `# Obsidian Marp Plugin` → `# Marp Extended`
- [ ] Update GitHub URLs to new repository
- [ ] Review entire file for old references

### 10. CLAUDE.md
- [ ] **Line 1**: Change title to `marp-extended-plugin`
- [ ] **Line 5**: Update description

### 11. AGENTS.md
- [ ] **Line 1**: Change title to `marp-extended-plugin`

### 12. docs/ARCHITECTURE.md
- [ ] Update directory references

### 13. docs/DEVELOPMENT.md
- [ ] Update git clone URL and directory name

### 14. docs/CLI_ARCHITECTURE_PROPOSAL.md
- [ ] Update directory and package references

---

## Summary Checklist

### Critical (Coexistence)
| # | Item | Status |
|---|------|--------|
| 1 | Plugin ID | ✅ DONE |
| 2 | View Type | ✅ DONE |
| 3 | Default Theme Dir | ✅ KEPT (sharing) |
| 4 | CSS Classes | ✅ DONE |
| 5 | Element IDs | ✅ DONE |

### Standard (Branding)
| # | Item | Status |
|---|------|--------|
| 6 | Package name | ✅ DONE |
| 7 | Package lock | ⬜ Run npm install |
| 8 | Plugin metadata | ✅ DONE |
| 9 | README | ⬜ TODO |
| 10 | CLAUDE.md | ⬜ TODO |
| 11 | AGENTS.md | ⬜ TODO |
| 12 | docs/ARCHITECTURE.md | ⬜ TODO |
| 13 | docs/DEVELOPMENT.md | ⬜ TODO |
| 14 | docs/CLI_ARCHITECTURE_PROPOSAL.md | ⬜ TODO |

---

## Post-Rename Tasks

- [ ] Run `npm install` to regenerate `package-lock.json`
- [ ] Run `npm run build` to verify no build errors
- [ ] Test the plugin loads correctly in Obsidian alongside the original Marp plugin
- [ ] Verify settings are stored in `.obsidian/plugins/marp-extended/`
- [ ] Test that both plugins can be enabled simultaneously without conflicts
