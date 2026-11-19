async (f, name) => {
  const log = [];
  const settle = async (ms = 1200) => { await f.sleep(ms); };
  const go = async (num) => { await f.hangup(); await f.sleep(400); await f.dialBoard(num); await f.toMenu(); await settle(); };
  f.lamp(false); f.speed(28800); f.power(true); await f.waitFor("KESTREL MENU", 30000); await f.lean(true, 0);
  f.key("1"); await f.sleep(600); await f.dialBoard("555-0167"); await f.toMenu(); await settle(1500);
  const blob = await f.record(name, async (h) => {
    // beat 1: FULL BLOCK tiles
    await h.at(0.8); h.key("ArrowRight"); await h.at(1.35); h.key("ArrowRight");
    await h.at(2.0); await h.cut(() => go("555-0193")); log.push(["LN", h.now(), h.screen().slice(0, 300)]);
    // beat 2: LINE NOISE L listing
    await h.at(2.3); h.key("L");
    await h.at(4.0); await h.cut(() => go("555-0128")); log.push(["MR", h.now(), h.screen().slice(0, 300)]);
    // beat 3: MAPLE RIDGE
    await h.at(4.35); h.key("2"); await h.at(5.05); h.key("ArrowDown"); await h.at(5.5); h.key("ArrowDown");
    await h.at(6.0); await h.cut(() => go("555-0177")); log.push(["ST", h.now(), h.screen().slice(0, 300)]);
    // beat 4: STROBE (meter animates by itself)
    await h.at(8.0); await h.cut(async () => {
      await go("555-0142"); h.key("D"); await h.waitFor("THE CORNER", 8000); await h.sleep(300); h.key("2"); await h.waitFor("Thirty days", 8000); await h.sleep(300);
      h.key("2"); await h.waitFor("DAY 1 OF 30", 8000); await h.sleep(300);
      h.key("3"); await h.sleep(400); h.key("4"); await h.sleep(150); h.key("Enter"); await h.waitFor("DAY 2 OF 30", 8000); await h.sleep(900);
    }); log.push(["DC", h.now(), h.screen().slice(0, 300)]);
    // beat 5: THE CORNER, one buy keypress
    await h.at(8.6); h.key("1");
    await h.at(9.5);
  });
  f.save(blob, name + ".webm");
  return { ...f.stats(), log };
}
