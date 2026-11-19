async (f, name) => {
  const log = [];
  const done = () => { const h = f.hints(); return h.some((x) => x.label === "PGUP") && h.some((x) => x.label === "I info"); };
  f.lamp(false); f.speed(28800); f.power(true); await f.waitFor("KESTREL MENU", 30000); await f.lean(true, 0);
  f.key("1"); await f.sleep(600); await f.dialBoard("555-0142"); await f.toMenu();
  f.key("Y"); await f.waitFor("Your shelf", 20000); await f.sleep(400);
  f.key("Enter"); await f.until(done, 20000); f.key("Escape"); await f.waitFor("Your shelf", 10000); await f.sleep(300);
  f.key("ArrowDown"); await f.sleep(200); f.key("Enter"); await f.until(done, 20000); f.key("Escape"); await f.waitFor("Your shelf", 10000); await f.sleep(300);
  f.key("ArrowUp"); await f.sleep(600);
  const blob = await f.record(name, async (h) => {
    await h.at(0.5); h.key("Enter");
    await h.until(done, 6000); log.push(["logo done", h.now()]);
    await h.at(2.4);
    await h.cut(async () => { h.key("Escape"); await h.waitFor("Your shelf", 5000); await h.sleep(100); h.key("ArrowDown"); await h.sleep(100); h.key("Enter"); await h.sleep(30); });
    log.push(["mountain start", h.now()]);
    const lean = (async () => { await h.at(3.0); await h.lean(false, 1500); log.push(["leaned back", h.now()]); })();
    await h.until(done, 8000); log.push(["mountain done", h.now()]);
    await lean;
    await h.at(7.0); h.key("I"); log.push(["info", h.now()]);
    await h.at(8.5);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
