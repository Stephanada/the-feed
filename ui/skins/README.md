# The Feed — Skin Specification

A skin is a JSON file that defines the visual identity of the `<the-feed-ingest>`
and `<the-feed-event>` Web Components. Skins are portable, shareable, and
optionally publishable to the community skin registry.

---

## Skin JSON Schema

```json
{
  "id": "my-skin",
  "name": "My Skin",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "One-line description",
  "style_id": "optional-public-registry-slug",
  "modes": {
    "light": {
      "colors": {
        "accent":         "#e94560",
        "accent_text":    "#ffffff",
        "background":     "#ffffff",
        "surface":        "#f9f9fb",
        "border":         "#e2e2e8",
        "text_primary":   "#111111",
        "text_secondary": "#555555",
        "text_muted":     "#888888",
        "success":        "#22c55e",
        "warning":        "#f59e0b",
        "danger":         "#ef4444"
      },
      "typography": {
        "font_family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "font_size_base": "15px",
        "font_weight_normal": "400",
        "font_weight_bold": "700"
      },
      "shape": {
        "radius_input": "10px",
        "radius_btn":   "8px",
        "radius_card":  "12px",
        "shadow_card":  "0 2px 12px rgba(0,0,0,0.08)"
      }
    },
    "dark": {
      "colors": { ... },
      "typography": { ... },
      "shape": { ... }
    }
  }
}
```

## Fields

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique slug. Used as the `skin` attribute value. |
| `name` | ✅ | Human-readable display name |
| `author` | ✅ | Creator name or handle |
| `version` | ✅ | Semver |
| `description` | — | Short description |
| `style_id` | — | Public registry ID (future marketplace slug). Optional — omit for private skins. |
| `modes.light` | ✅ | Light mode token values |
| `modes.dark` | ✅ | Dark mode token values |

## Usage

**Built-in skin (by ID):**
```html
<the-feed-ingest skin="broadcast"></the-feed-ingest>
```

**Remote skin (by URL):**
```html
<the-feed-ingest skin="https://example.com/my-skin.json"></the-feed-ingest>
```

**Inline skin override (CSS custom properties):**
```css
the-feed-ingest {
  --tfi-accent: #ff6b35;
  --tfi-background: #1a1a1a;
}
```

## Built-in Presets

| ID | Name | Vibe |
|---|---|---|
| `default` | Default | Clean, neutral, works anywhere |
| `broadcast` | Broadcast | Dark, techy, radio station dashboard |
| `poster` | Poster | Bold, high-contrast, music venue energy |

## Community Marketplace (Future)

Skins with a `style_id` field can be submitted to the public registry at
`https://skins.the-feed.ca` (planned). A `style_id` is your skin's permanent
public identifier — choose it carefully. Format: `author/skin-name`.

Example: `"style_id": "stephan/vista-dark"`
