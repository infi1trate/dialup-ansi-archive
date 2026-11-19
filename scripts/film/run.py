import asyncio, json, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
name, js, secs = sys.argv[1], Path(sys.argv[2]).read_text(), (sys.argv[3] if len(sys.argv) > 3 else "240")
OUT = Path("/tmp/browser/film/out"); OUT.mkdir(parents=True, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width":1920,"height":1080}, accept_downloads=True, timezone_id="America/New_York")
        page = await ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"[:300]))
        page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"[:400]))
        t0 = time.time()
        await page.goto(f"http://localhost:8080/?film={secs}", wait_until="domcontentloaded")
        await page.wait_for_function("window.__film", timeout=120000)
        ok = await page.evaluate("window.__film.ready()")
        print("ready", ok, round(time.time()-t0,1), flush=True)
        try:
            async with page.expect_download(timeout=1800000) as dl:
                stats = await page.evaluate(f"(async () => {{ const f = window.__film; const run = {js}; return await run(f, {json.dumps(name)}); }})()")
            d = await dl.value
            await d.save_as(str(OUT / f"{name}.webm"))
            print("stats", json.dumps(stats), flush=True)
        except Exception as e:
            print("ERROR", str(e)[:2000])
            await page.screenshot(path=str(OUT / f"{name}-error.png"))
            try: print("screen:\n", await page.evaluate("window.__film.screen()"))
            except Exception: pass
        print("elapsed", round(time.time()-t0,1))
        await page.screenshot(path=str(OUT / f"{name}-dom.png"))
        for l in logs:
            if not l.startswith("debug") and "Download the React DevTools" not in l: print(l)
        await b.close()
asyncio.run(main())
