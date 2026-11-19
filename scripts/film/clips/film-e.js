async (f, name) => {
  const log = [];
  f.lamp(false); f.power(true); await f.waitFor("KESTREL MENU", 30000);
  f.key("5"); await f.waitFor("C:\\>", 10000); await f.sleep(300);
  await f.type("CD \\WAREZ\\EMBER\r", 30); await f.waitFor("C:\\WAREZ\\EMBER>", 5000);
  await f.type("CLS\r", 30); await f.sleep(800);
  log.push(["screen", f.screen().split("\n").slice(0, 3).join("|")]);
  const blob = await f.record(name, async (h) => {
    await h.at(0.6); await h.type("EMBER", 6.5);
    await h.at(1.55); h.key("Enter");
    await h.at(5.0); h.degauss(); log.push(["degauss", h.now()]);
    await h.at(6.5); log.push(["end", h.screen().split("\n").slice(0, 25).join("|").slice(0, 600)]);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
