import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

// Handwritten articles and the pages scripts/generate-docs.ts writes from the Catalog.
export const collections = {
  docs: defineCollection({
    loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
    schema: z.object({ title: z.string(), description: z.string().optional() }),
  }),
}
