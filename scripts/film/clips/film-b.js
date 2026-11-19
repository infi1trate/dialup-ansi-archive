async (f, name) => {
  const log = [];
  f.lamp(false); f.power(true); await f.waitFor("KESTREL MENU", 30000); await f.lean(true, 0); await f.sleep(600);
  const blob = await f.record(name, async (h) => {
    await h.at(0.6); h.key("1");
    await h.at(1.0);
    for (const k of ["ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowUp","ArrowUp","ArrowUp","ArrowUp"]) { h.key(k); await h.sleep(175); }
    await h.at(2.5);
    const offHook = h.event("offHook"), connect = h.event("connect");
    h.key("Enter");
    await h.waitFor("ATZ", 3000); await h.sleep(60);
    const t = await (async () => { let v = 0; await h.cut(async () => { v = await offHook; await h.sleep(150); }); return v; })();
    log.push(["offhook", t]);
    await h.showUntil(t + 2020);           // dial tone, seven touch tones, a breath
    await h.cutUntil(t + 2620);
    await h.showUntil(t + 3520);           // one ring
    await h.cutUntil(t + 5220);            // answer
    await h.showUntil(t + 7720);           // handshake, first 2.5 s
    await h.cutUntil(t + 10720);
    await connect; log.push(["connect", h.now()]);
    await h.waitFor("[H]ang up", 8000); log.push(["matrix", h.now()]);
    await h.sleep(250);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
