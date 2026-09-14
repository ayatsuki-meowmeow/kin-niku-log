const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'

export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, options)
  const body = [204, 205, 304].includes(res.status) ? undefined : await res.json()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return { data: body, status: res.status, headers: res.headers } as T
}
