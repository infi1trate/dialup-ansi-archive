async (f, name) => {
  const log = [];
  const done = () => { const h = f.hints(); return h.some((x) => x.label === "PGUP") && h.some((x) => x.label === "I info"); };
  f.lamp(false); f.speed(28800); f.power(true); await f.waitFor("KESTREL MENU", 30000);
  f.key("1"); await f.sleep(600); await f.dialBoard("555-0142"); await f.toMenu();
  f.key("Y"); await f.waitFor("Your shelf", 20000); await f.sleep(400);
  f.key("ArrowDown"); await f.sleep(200); f.key("Enter"); await f.until(done, 20000); await f.sleep(1500);
  const blob = await f.record(name, async (h) => {
    await h.at(0.7); const p = h.photo(); log.push(["photo", h.now()]);
    await h.until(() => !!document.querySelector(".photo-closeup"), 5000); log.push(["closeup", h.now()]);
    await p; log.push(["photo resolved", h.now()]);
    await h.at(6.5);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
