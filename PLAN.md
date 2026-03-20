# Phase 1 Plan: Blog Infrastructure

## Critical Architecture Decision

**The existing app is a React 19 + Vite SPA, NOT Astro.** The spec says "Astro (already in use)" but that's incorrect. We need to add Astro as a **separate build** for the blog alongside the existing React app.

### Approach: Separate Astro project in `blog/` directory

```
fireplanner-private/
  frontend/          # Existing React + Vite SPA (unchanged)
  blog/              # NEW: Astro project for /blog routes only
  scripts/
    build-all.mjs    # Builds both, merges into frontend/dist/blog/
```

**How it works:**
1. `blog/` is a standalone Astro project configured with `base: '/blog'` and `outDir: '../frontend/dist/blog'`
2. Build order: React SPA first (`frontend/`), then Astro blog, which outputs directly into `frontend/dist/blog/`
3. Update `frontend/public/_redirects` to exclude `/blog/*` from the SPA catch-all (CF Pages serves real HTML for blog routes)
4. Single `wrangler pages deploy frontend/dist` deploys everything

**Why this approach:**
- Zero risk to the existing SPA (no changes to Vite/React build)
- Astro content collections work natively for MDX
- Blog pages are fully pre-rendered static HTML (great for SEO)
- Clean separation of concerns
- Easy to test independently (`cd blog && npm run dev`)

---

## Files to Create (in order)

### Step 1: Astro project setup
1. `blog/package.json` -- Astro + MDX + sitemap + Tailwind dependencies
2. `blog/astro.config.mjs` -- base: '/blog', MDX integration, sitemap, Tailwind
3. `blog/tsconfig.json` -- Astro TS config
4. `blog/tailwind.config.ts` -- Reuse same design tokens as main app (copy CSS vars)
5. `blog/src/styles/global.css` -- Tailwind directives + same CSS custom properties from frontend

### Step 2: Content collection schema
6. `blog/src/content.config.ts` -- Blog collection with the schema from spec (title, description, pubDate, category, tags, intent, keyword, author, readingTime, draft, noindex)

### Step 3: Blog layout and components
7. `blog/src/layouts/BlogPost.astro` -- Article layout: header, prose content, disclaimer, CTA, related posts. Visually matches main app (same fonts, colors, card style)
8. `blog/src/layouts/BlogList.astro` -- Layout for listing pages
9. `blog/src/components/BlogHead.astro` -- `<head>` with OG tags, JSON-LD Article schema, canonical URL
10. `blog/src/components/Disclaimer.astro` -- MAS compliance disclaimer
11. `blog/src/components/CTA.astro` -- Configurable call-to-action linking to planner tools
12. `blog/src/components/ComparisonTable.astro` -- Responsive comparison tables
13. `blog/src/components/TOC.astro` -- Auto-generated table of contents
14. `blog/src/components/RelatedPosts.astro` -- Related articles by category/tags
15. `blog/src/components/BreadcrumbNav.astro` -- Breadcrumb nav with schema markup
16. `blog/src/components/BlogCard.astro` -- Card for blog listing pages
17. `blog/src/components/CategoryFilter.astro` -- Category filter chips for listing

### Step 4: Blog pages
18. `blog/src/pages/index.astro` -- Blog listing with category filters
19. `blog/src/pages/[slug].astro` -- Individual post page
20. `blog/src/pages/category/[category].astro` -- Category listing
21. `blog/src/pages/rss.xml.ts` -- RSS feed

### Step 5: Test content (3 MDX posts)
22. `blog/src/content/blog/stashaway-vs-syfe-robo-advisor-comparison-2026.mdx` -- Comparison intent
23. `blog/src/content/blog/top-cpf-strategies-early-retirement-singapore.mdx` -- Best_for intent
24. `blog/src/content/blog/maximise-srs-tax-savings-singapore.mdx` -- How_to intent

### Step 6: Build integration
25. `scripts/build-all.mjs` -- Orchestrates: build frontend, then build blog into frontend/dist/blog/
26. Update `frontend/public/_redirects` -- Add `/blog/*` exclusion before SPA catch-all
27. Update `frontend/public/sitemap.xml` -- Add blog index + test post URLs
28. Update `frontend/public/robots.txt` -- Add Sitemap directive, allow /blog/

### Step 7: Verify
- `cd blog && npm run dev` -- Blog works standalone at localhost:4321/blog
- `node scripts/build-all.mjs` -- Full build completes, blog HTML in frontend/dist/blog/
- Blog pages have correct meta tags, JSON-LD, OG tags
- Disclaimer shows on every post
- RSS feed generates valid XML
- Category pages render correctly

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/public/_redirects` | Add `/blog/* /blog/index.html 200` line BEFORE the SPA catch-all, actually no -- Astro generates real HTML files, so we just need to make sure the SPA catch-all doesn't intercept `/blog/*`. Change to `/blog/* /blog/:splat 200` or simply let CF Pages serve the static files by not matching blog routes. |
| `frontend/public/sitemap.xml` | Add blog URLs |
| `frontend/public/robots.txt` | Add `Sitemap: https://sgfireplanner.com/sitemap.xml` if missing, allow `/blog/` |
| `frontend/package.json` | Add `build:full` script that runs both builds |

---

## Questions / Flags

1. **`_redirects` handling**: The current rule `/* /index.html 200` is a catch-all that would intercept `/blog/*` requests. Since Astro outputs real HTML files into `dist/blog/`, CF Pages should serve those files directly. CF Pages serves static files first before applying `_redirects`, so if `dist/blog/index.html` exists, it will be served. **No change needed to `_redirects`** -- CF Pages checks for real files before applying redirect rules. I'll verify this works.

2. **Styling consistency**: The blog will use the same Tailwind config and CSS custom properties as the main app but in a separate Tailwind build. The blog won't share the React component library (shadcn/ui), but will replicate the visual style with plain HTML/CSS + Tailwind's typography plugin.

3. **Navigation between SPA and blog**: Links from blog to SPA tools (e.g., "Try the FIRE Calculator") will be regular `<a href="/">` links (full page navigation). Links from the SPA to blog would similarly be `<a href="/blog/">` links. No React Router integration needed.

4. **Font loading**: The main app loads Syne from Google Fonts. The blog layout will include the same font link.

5. **Dark mode**: The main app supports dark mode via `.dark` class. The blog will support it too using the same CSS variables, but dark mode toggle will be simpler (localStorage check on page load).

6. **Astro sitemap vs static sitemap**: The spec mentions adding blog to sitemap config. Since the main app uses a static `sitemap.xml`, I'll manually add blog URLs there for now. In Phase 2, we can generate the blog sitemap from Astro and merge.

---

## Out of Scope (Phase 2+)

- SiteConfig system (`sites/sgfireplanner.json`)
- Keyword engine
- Content generator (Claude API)
- Article validation pipeline
- GitHub Actions workflow
- `tools/blog-engine/` directory
- `data/` directory (keywords.json, etc.)
