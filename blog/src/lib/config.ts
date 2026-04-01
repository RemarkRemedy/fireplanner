/** Shared blog configuration constants */

export const SITE_NAME = 'SG FIRE Planner';

export function toPostSlug(id: string) {
  return id.replace(/\.(md|mdx)$/i, '');
}

export const ANALYTICS = {
  src: 'https://analytics.sgfireplanner.com/script.js',
  websiteId: '8d1bb6d1-2dbc-4cdc-be00-016114b56291',
} as const;
