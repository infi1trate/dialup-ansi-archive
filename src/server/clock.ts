/** Local test browser only. Vite removes this branch from the published Worker. */
export function requestClock(req:Request):Date {
  if(import.meta.env.DEV && new URL(req.url).hostname==='localhost') {
    const raw=req.headers.get('x-dialup-test-clock');
    if(raw&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(raw)) {const date=new Date(raw);if(Number.isFinite(+date))return date;}
  }
  return new Date();
}