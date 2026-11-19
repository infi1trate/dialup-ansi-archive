async (f, name) => {
  const log = [];
  f.lamp(false); f.speed(28800); f.power(true); await f.waitFor("KESTREL MENU", 30000); await f.lean(true, 0);
  f.key("1"); await f.sleep(600); await f.dialBoard("555-0142"); await f.toMenu(); await f.sleep(1200);
  const blob = await f.record(name, async (h) => {
    await h.at(0.7); h.key("G");
    await h.at(1.15); h.key("Y");
    await h.waitFor("NO CARRIER", 6000); log.push(["no carrier", h.now()]);
    await h.at(Math.max(h.now() + 0.3, 3.1)); log.push(["lean", h.now()]); await h.lean(false, 1500);
    await h.at(5.0); h.monitor(false); log.push(["off", h.now()]);
    await h.at(6.5);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
