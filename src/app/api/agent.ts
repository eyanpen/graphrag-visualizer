import axios, { AxiosError, AxiosResponse } from 'axios';

/**
 * Dynamically resolve the API base URL.
 *
 * Strategy:
 * 1. If REACT_APP_API_URL is set and NOT localhost while we're accessing
 *    from a remote host, use the browser's hostname instead.
 * 2. If REACT_APP_API_URL is set, use it as-is.
 * 3. Otherwise, derive from the current browser location:
 *    same hostname, port from REACT_APP_API_PORT or default 16889.
 */
function resolveApiBaseUrl(): string {
  const envUrl = process.env.REACT_APP_API_URL;
  const apiPort = process.env.REACT_APP_API_PORT || '16889';

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      // If the env URL points to localhost/127.0.0.1 but the browser is
      // accessing from a different host, replace with the browser's hostname.
      const isEnvLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
      const isBrowserLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

      if (isEnvLocal && !isBrowserLocal) {
        // Remote access: use the browser's hostname with the API port
        return `${parsed.protocol}//${window.location.hostname}:${parsed.port || apiPort}`;
      }
      return envUrl;
    } catch {
      return envUrl;
    }
  }

  // No env URL configured: derive from browser location
  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:${apiPort}`;
}

axios.defaults.baseURL = resolveApiBaseUrl();
axios.defaults.withCredentials = false;

// Expose for debugging
console.log('[GraphRAG] API base URL:', axios.defaults.baseURL);

const responseBody = (response: AxiosResponse) => response.data;

// Intercept responses to handle errors globally
axios.interceptors.response.use(
  async (response) => {
    return response;
  },
  (error: AxiosError<any, any>) => {
    if (!error.response) {
      console.error('Network error: Server may be down');
      return Promise.reject(error);
    }
    const { data, status } = error.response;
    switch (status) {
      case 400:
        if (data.errors) {
          const modelStateErrors: string[] = [];
          for (const key in data.errors) {
            if (data.errors[key]) {
              modelStateErrors.push(data.errors[key]);
            }
          }
          console.error('Validation errors:', modelStateErrors.flat());
        } else {
          console.error('Bad request:', data.title);
        }
        break;
      case 401:
        console.error('Unauthorized:', data.title || 'Unauthorized');
        break;
      case 403:
        console.error('Forbidden: You are not allowed to do that!');
        break;
      case 500:
        console.error('Server Error:', data.title || 'Server Error!');
        break;
      default:
        console.error('An unexpected error occurred.');
        break;
    }
    return Promise.reject(error.response);
  }
);

const requests = {
  get: (url: string, params?: URLSearchParams) =>
    axios.get(url, { params }).then(responseBody),
  post: (url: string, body?: {}, params?: URLSearchParams) =>
    axios.post(url, body, { params }).then(responseBody),
  put: (url: string, body: {}) => axios.put(url, body).then(responseBody),
  delete: (url: string) => axios.delete(url).then(responseBody),
  getBlob: (url: string) =>
    axios.get(url, { responseType: 'arraybuffer' }).then((res) => res.data as ArrayBuffer),
};

export interface DataSourceInfo {
  name: string;
  path: string;
  description: string;
  active: boolean;
}

const Search = {
  global: (query: string) => requests.get('search/global', new URLSearchParams({ query })),
  local: (query: string) => requests.get('search/local', new URLSearchParams({ query })),
  drift: (query: string) => requests.get('search/drift', new URLSearchParams({ query })),
  basic: (query: string) => requests.get('search/basic', new URLSearchParams({ query })),
};

const DataSources = {
  list: (): Promise<{ data_sources: DataSourceInfo[] }> => requests.get('api/datasources'),
  switch: (name: string) => requests.post('api/datasources/switch', undefined, new URLSearchParams({ name })),
  current: (): Promise<{ current_source: string }> => requests.get('api/datasources/current'),
  listParquetFiles: (): Promise<{ files: string[] }> => requests.get('api/parquet'),
  getParquetFile: (filename: string): Promise<ArrayBuffer> => requests.getBlob(`api/parquet/${filename}`),
};

const Status = {
  check: () => requests.get('status'),
};

const Config = {
  get: () => requests.get('api/config'),
};

const agent = {
  Search,
  DataSources,
  Status,
  Config,
};

export default agent;
