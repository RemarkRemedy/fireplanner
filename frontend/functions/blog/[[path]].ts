/**
 * Reverse proxy for /blog/* requests.
 * Rewrites /blog/foo → /foo on the standalone blog project (sgfireplanner-blog.pages.dev).
 * This keeps the blog at sgfireplanner.com/blog/ for SEO while allowing independent deploys.
 */
const BLOG_ORIGIN = 'https://sgfireplanner-blog.pages.dev'

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const blogPath = url.pathname.replace(/^\/blog/, '') || '/'
  const blogUrl = new URL(blogPath, BLOG_ORIGIN)
  blogUrl.search = url.search

  const response = await fetch(blogUrl.toString(), {
    method: request.method,
    headers: request.headers,
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
