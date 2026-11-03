---
name: tailwind-v4
description: Guidelines, best practices, and configuration standards for Tailwind CSS v4. Covers CSS-first configurations, @import directives, @theme tokens, and PostCSS setup.
---

# Tailwind CSS v4 Development Skill

Comprehensive guidance for writing, styling, and configuring applications using **Tailwind CSS v4**.

## 1. Core Architecture & Differences from v3

- **CSS-First Configuration**: Tailwind v4 removes `tailwind.config.js/ts` as the primary configuration mechanism. Theme customizations, color palettes, and container rules are declared directly inside CSS files.
- **Root Import**:
  ```css
  /* globals.css */
  @import "tailwindcss";
  ```
- **PostCSS Requirement**: In standard Webpack/Next.js builds without full Turbopack native CSS bundling, ensure `@tailwindcss/postcss` is installed and registered in `postcss.config.mjs`:
  ```js
  export default {
    plugins: {
      "@tailwindcss/postcss": {},
    },
  };
  ```

## 2. Theme Customization via `@theme`

Declare design system tokens directly in CSS using `@theme`:
```css
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --font-sans: var(--font-geist-sans);
}
```

## 3. Dark Mode Variants
Tailwind v4 handles custom variant definitions natively:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
This enables class-based dark mode toggles:
```html
<div class="bg-surface text-foreground dark:bg-zinc-900 dark:text-zinc-100">
  ...
</div>
```

## 4. Best Practices for Components
- **Avoid Over-Abstraction**: Use utility classes directly in JSX. Extract into CSS utility classes (`.card`, `.btn-primary`) only for widely reused base controls.
- **Dynamic Classes Warning**: Never construct dynamic class names like `text-${color}-500`. Always write complete, searchable class names or map objects:
  ```tsx
  // Good:
  const badgeColors = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  };
  ```
- **Responsive Layouts**: Design mobile-first. Default classes target mobile (`< 640px`), then layer `sm:`, `md:`, `lg:`, and `xl:`.
