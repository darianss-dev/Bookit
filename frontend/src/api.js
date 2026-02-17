const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  books: {
    list: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
      return request('/books' + (qs ? '?' + qs : ''));
    },
    genres: () => request('/books/genres'),
    get: (id) => request(`/books/${id}`),
    create: (data) => request('/books', { method: 'POST', body: data }),
    update: (id, data) => request(`/books/${id}`, { method: 'PUT', body: data }),
    toggleRecommend: (id) => request(`/books/${id}/recommend`, { method: 'PATCH' }),
    delete: (id) => request(`/books/${id}`, { method: 'DELETE' }),
  },
  sync: {
    status: () => request('/sync/status'),
    push: () => request('/sync/push', { method: 'POST' }),
    pull: () => request('/sync/pull', { method: 'POST' }),
  },
};
