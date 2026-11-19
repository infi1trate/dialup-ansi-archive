async (f, name) => {
  const log = [];
  const blob = await f.record(name, async (h) => {
    await h.at(1.5); h.lamp(false);
    await h.at(3.5); h.power(true);
    await h.at(5.5); const lean = h.lean(true, 2500);
    await h.waitFor("KESTREL MENU", 20000); log.push(["menu", h.now()]);
    await lean;
    await h.at(8.5);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log, screen: f.screen().split("\n").slice(0, 25).join("|") };
}
