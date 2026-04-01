import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    category: z.enum([
      'cpf',
      'srs',
      'investing',
      'insurance',
      'property',
      'fire-strategies',
      'tax',
      'brokerage',
      'robo-advisors',
      'savings',
      'comparisons',
      'guides',
    ]),
    tags: z.array(z.string()),
    intent: z.enum([
      'comparison',
      'alternative',
      'best_for',
      'how_to',
      'review',
      'vs',
    ]),
    keyword: z.string(),
    author: z.string().default('SG FIRE Planner'),
    readingTime: z.number().optional(),
    tocLabels: z.record(z.string()).optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
  }),
});

export const collections = { blog };
