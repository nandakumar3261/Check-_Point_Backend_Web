/* Tiny client-side router (History API, no framework).
 *
 * Each page (admin / user) is a single-page app whose "sections" (Home,
 * Images, Logs ...) get their own address, e.g.  /user/logs  /admin/assign-duty
 * The server must return the same page for every address under /admin/ (or
 * /user/) - see vite.config.js (dev / preview) and vercel.json (hosting).
 *
 *   const router = createRouter({ base: '/user', routes: { home: 'home', logs: 'logs' } });
 *   router.current()          -> section for the current address ('home' if unknown)
 *   router.push('logs')       -> pushState('/user/logs')   (adds a history entry)
 *   router.replace('home')    -> replaceState              (no new history entry)
 *   router.onChange(fn)       -> fn(section) on browser Back / Forward
 */
function createRouter({ base, routes, fallback = 'home' }) {
  const sections = Object.keys(routes);
  const pathFor = (section) => base + '/' + routes[section];

  function current() {
    // /admin/logs -> ['admin', 'logs'];  /admin or /admin/ -> ['admin']
    const parts = location.pathname.split('/').filter(Boolean);
    const slug = parts[1] || '';
    return sections.find((s) => routes[s] === slug) || fallback;
  }

  function push(section) {
    const path = pathFor(section);
    if (location.pathname !== path) history.pushState({ section }, '', path + location.search);
  }

  function replace(section) {
    history.replaceState({ section }, '', pathFor(section) + location.search);
  }

  function onChange(fn) {
    window.addEventListener('popstate', () => fn(current()));
  }

  return { current, push, replace, onChange };
}
