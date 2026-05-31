# Reference UI — Stitch export

Place Google Stitch export assets here for design audits:

```
reference-ui/
  stitch-export/     # HTML/CSS/component export from Stitch
  project-brief/     # Design brief, screenshots, notes
  assets/            # Shared images, icons, tokens source files
```

The app consumes **design language only** — tokens, typography, spacing, and visual patterns are centralized in:

- `src/styles/tokens.css`
- `src/styles/design-system.css`

Do not import Stitch export code directly into `src/`. Adapt styles incrementally into existing components.
