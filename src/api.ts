export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(url: string, payload?: unknown): Promise<T> {
  const response = await fetch(url, { method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const body = await response.json().catch(() => ({ error: 'The server could not be reached. Please try again.' }));
  if (!response.ok) throw new ApiError(body.error ?? 'Something went wrong.', response.status);
  return body as T;
}
