# SGFirePlanner SEO and Distribution Plan

## Requirements Summary

- Map the highest-value SEO targets for `sgfireplanner.com`
- Recommend a practical distribution plan that does not rely on repeated self-promotional Reddit launch posts
- Ground recommendations in current search landscape and current site structure

## Acceptance Criteria

- The plan identifies priority keyword clusters with page recommendations
- The plan distinguishes near-term wins from longer-term opportunities
- The plan includes a distribution sequence with concrete channel roles
- The plan accounts for the site's current indexing/metadata constraints
- The plan cites the evidence used to justify prioritization

## Evidence

- Product positioning and feature set in [README](../../README.md)
- Launch validation in `r/singaporefi` vs `r/singaporestartups`
- Current search results show official/brand calculators ranking for `retirement calculator Singapore`, `CPF projection calculator`, and `SRS calculator Singapore`
- Current repo includes sitemap, robots, and a prerender script:
  - [frontend/public/sitemap.xml](../../frontend/public/sitemap.xml)
  - [frontend/public/robots.txt](../../frontend/public/robots.txt)
  - [frontend/scripts/prerender.mjs](../../frontend/scripts/prerender.mjs)
  - [frontend/src/hooks/usePageMeta.ts](../../frontend/src/hooks/usePageMeta.ts)

## Keyword Map

### Tier 1: Closest to conversion and product fit

1. `singapore retirement calculator`
2. `singapore retirement planner`
3. `cpf retirement calculator`
4. `cpf projection calculator singapore`
5. `srs calculator singapore`

Recommended pages:

- `/retirement-calculator`
- `/retirement-planner`
- `/cpf-retirement-calculator`
- `/cpf-projection-calculator`
- `/srs-calculator-singapore`

### Tier 2: Strong secondary intent

1. `singapore fire calculator`
2. `financial independence calculator singapore`
3. `retirement withdrawal calculator singapore`
4. `monte carlo retirement calculator singapore`
5. `cpf life payout planning`

Recommended pages:

- `/singapore-fire-calculator`
- `/withdrawal-strategies`
- `/monte-carlo-retirement-calculator`
- `/cpf-life-planning`

### Tier 3: Editorial / problem-led queries

1. `how much to retire in singapore`
2. `how much cpf do i need to retire`
3. `4 percent rule singapore`
4. `srs or cpf top up`
5. `retirement planning singapore hdb downgrade`

Recommended content:

- Editorial guides and comparison pages linked into the product pages

## Prioritization

### Build first

- `/cpf-retirement-calculator`
- `/cpf-projection-calculator`
- `/srs-calculator-singapore`
- `/monte-carlo-retirement-calculator`
- `/singapore-fire-calculator`

Rationale:

- These align tightly with differentiated product features
- The SERPs already show calculator/tool intent
- SGFirePlanner can win by being the only tool that ties these topics together in one Singapore-specific workflow

### Keep but reposition

- `/retirement-calculator`
- `/retirement-planner`

Rationale:

- These are broad and valuable, but more competitive
- They should function as hub pages that route traffic to narrower, higher-intent calculators

## Site Constraints and Mitigations

- The site already has sitemap/robots coverage and a prerender pipeline
- Search results still suggest some routes are surfacing with generic or duplicated metadata
- Inference: either the deployed build is not fully shipping prerendered route HTML, or Google has not yet reprocessed the updated metadata

Mitigations:

1. Verify deployed HTML for top landing pages contains route-specific `<title>`, description, canonical, and body copy without JS
2. Expand sitemap with every SEO landing page
3. Add internal links between hub pages, calculator pages, and the reference guide
4. Give each landing page 300-800 words of static explanatory copy above or below the app shell

## Distribution Plan

### Core strategy

- Use SEO as the primary acquisition engine
- Use community participation for trust, not for repeated launch-style promotion
- Use publisher/creator distribution to accelerate discovery and backlinks

### 30-day sequence

#### Week 1

- Ship 3 landing pages: CPF retirement, CPF projection, SRS calculator
- Tighten titles/descriptions/canonicals on existing routes
- Add product-to-content internal links

#### Week 2

- Publish 2 supporting articles:
  - `How much do you need to retire in Singapore?`
  - `CPF vs SRS vs taxable portfolio for retirement`
- Seed those pages in relevant Reddit/Seedly discussions only when directly relevant

#### Week 3

- Reach out to Singapore finance publishers and creators with a reader-value angle:
  - Seedly
  - DollarsAndSense
  - Dr Wealth
  - Endowus content/editorial team
- Offer a short demo, data-backed explanation, or guest contribution instead of a generic launch pitch

#### Week 4

- Publish a comparison page:
  - `CPF Board Retirement Payout Planner vs SGFirePlanner`
  - or `Best Singapore retirement calculators`
- Track indexed pages, ranking movement, and pages that attract backlinks

## Risks and Mitigations

- Risk: broad `FIRE` keywords attract irrelevant fire-safety/noise traffic
  - Mitigation: prefer `Singapore FIRE calculator` and `financial independence calculator singapore`, not plain `fire calculator`
- Risk: repeated Reddit posts are perceived as self-promo
  - Mitigation: shift to comment-level participation and occasion-based posts only when there is new user value
- Risk: broad retirement terms are dominated by banks and official tools
  - Mitigation: target narrower SG-specific calculator intents first, then use those pages to support broader hub terms

## Verification Steps

1. Search Google for each target term and record current top 10 competitors
2. Confirm each landing page returns unique HTML metadata in the deployed site
3. Submit updated sitemap in Search Console
4. Measure impressions/clicks for each cluster after 2-4 weeks
5. Reprioritize based on actual impressions and engagement
