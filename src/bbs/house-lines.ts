// What each board says when the house interferes with the line. One status-row line each, in the board's voice.
export const HOUSE_LINES: Record<string, { rattle: string; yelled: string }> = {
  crawl: { rattle: "someone is rattling your line. one minute. Ctrl-S to yell 'five more minutes'", yelled: "Static: you yelled. they hung up the extension. the line is yours." },
  vault: { rattle: "Halftone: an extension is off the hook. One minute. Ctrl-S: 'five more minutes'", yelled: "Halftone: extension back on the hook. Carry on drawing." },
  c93: { rattle: "someone is rattling your line. one minute. ctrl-s to yell 'five more minutes'.", yelled: "the extension clicked back down. the line is quiet again." },
  maple: { rattle: "Mr. Hutchins: Someone at home needs the telephone. One minute, please. (Ctrl-S)", yelled: "Mr. Hutchins: Thank you. Please be polite to your family." },
  strobe: { rattle: "KICKDRUM: SOMEONE UPSTAIRS WANTS THE LINE. 1 MIN. CTRL-S = 'FIVE MORE MINUTES'", yelled: "KICKDRUM: THEY BACKED OFF. KEEP DANCING." },
  attic: { rattle: "Dustline: footsteps upstairs, a hand on the phone. One minute. Ctrl-S to yell.", yelled: "Dustline: the footsteps went away. The shelves are yours." },
  void: { rattle: "someone else is on this line. sixty seconds. Ctrl-S", yelled: "they left. no one heard." },
};
export const houseLines = (id: string) => HOUSE_LINES[id] ?? HOUSE_LINES.crawl;
