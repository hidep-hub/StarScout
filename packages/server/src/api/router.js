// パスパラメータ(:id等)対応の最小限のルーター。
export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const paramNames = [];
    const regexSource = pattern
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          paramNames.push(segment.slice(1));
          return '([^/]+)';
        }
        return segment;
      })
      .join('/');
    routes.push({ method, regex: new RegExp(`^${regexSource}$`), paramNames, handler });
  }

  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const result = route.regex.exec(pathname);
      if (!result) continue;
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(result[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  return {
    get: (pattern, handler) => add('GET', pattern, handler),
    post: (pattern, handler) => add('POST', pattern, handler),
    put: (pattern, handler) => add('PUT', pattern, handler),
    delete: (pattern, handler) => add('DELETE', pattern, handler),
    match,
  };
}
