export class ApiError extends Error {
  status: number
  url: string
  body?: unknown

  constructor(message: string, status: number, url: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.url = url
    this.body = body
  }
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000"
}

async function parseBody(res: Response) {
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) return res.json()
  return res.text()
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`

  const { timeoutMs, ...rest } = init
  const controller = new AbortController()
  const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(rest.headers || {}),
      },
    })

    if (!res.ok) {
      const body = await parseBody(res).catch(() => undefined)
      throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, res.status, url, body)
    }

    return (await parseBody(res)) as T
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

