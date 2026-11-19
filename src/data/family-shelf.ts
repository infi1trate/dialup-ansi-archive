export interface FamilyPiece {pack:string;file:string;artist:string}
export const FAMILY_SHELF:FamilyPiece[]=[
  {
    "pack": "ensiart",
    "file": "ALANTIC.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "ARISTA.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "ATCO.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "CAPITOL.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "CHARISMA.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "CHRYSALI.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "ELEKTRA.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "EMI.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "EPIC.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "GEFFIN.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "GIANT.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "ISLAND.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "MCA.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "MOTOWN.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ensiart",
    "file": "GREAT.ANS",
    "artist": "brad garner"
  },
  {
    "pack": "ensiart",
    "file": "HEART.ANS",
    "artist": "greylens"
  },
  {
    "pack": "ensiart",
    "file": "KANSAS.ANS",
    "artist": "joseph crum"
  },
  {
    "pack": "ensiart",
    "file": "KISS.ANS",
    "artist": "phill piddell"
  },
  {
    "pack": "ensiart",
    "file": "N_RANGER.ANS",
    "artist": "joseph crum"
  },
  {
    "pack": "ensiart",
    "file": "NINTENDO.ANS",
    "artist": "unknown"
  },
  {
    "pack": "ensiart",
    "file": "OURHOUSE.ANS",
    "artist": "joseph crum"
  },
  {
    "pack": "ensiart",
    "file": "BUTRFLY.ANS",
    "artist": "l r dennis iii"
  },
  {
    "pack": "ensiart",
    "file": "CD.ANS",
    "artist": "alex albrinck"
  },
  {
    "pack": "ensiart",
    "file": "DC_FONT.ANS",
    "artist": "adrian clift"
  },
  {
    "pack": "ensiart",
    "file": "DS_MOON.ANS",
    "artist": "dave churm"
  },
  {
    "pack": "ensiart",
    "file": "EARTH.ANS",
    "artist": "john keeney"
  },
  {
    "pack": "ensiart",
    "file": "HAPYHOLY.ANS",
    "artist": "steve book"
  },
  {
    "pack": "ensiart",
    "file": "LIBERTY.ANS",
    "artist": "tom bradford"
  },
  {
    "pack": "ensiart",
    "file": "MY_FONT.ANS",
    "artist": "mike fuller"
  },
  {
    "pack": "ensiart",
    "file": "PARROT.ANS",
    "artist": "brad garner"
  },
  {
    "pack": "ensiart",
    "file": "PIANOMAN.ANS",
    "artist": "alex albrinck"
  },
  {
    "pack": "ensiart",
    "file": "QUILT.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ansicl01",
    "file": "APOLLO11.ANS",
    "artist": "jeff ulaszewski"
  },
  {
    "pack": "ansicl01",
    "file": "DARKSIDE.ANS",
    "artist": "pisonic advenger"
  },
  {
    "pack": "ansicl01",
    "file": "MOUNTAIN.ANS",
    "artist": "ansi-mation"
  },
  {
    "pack": "ansicl01",
    "file": "PARIS.ANS",
    "artist": "ian cameron"
  },
  {
    "pack": "ansicl20",
    "file": "AWTFALL.ANS",
    "artist": "brad garner"
  },
  {
    "pack": "ansicl20",
    "file": "NAUTICAL.ANS",
    "artist": "michael arnett"
  },
  {
    "pack": "ansicl20",
    "file": "THE_WOOD.ANS",
    "artist": "jan lobianco"
  },
  {
    "pack": "ansicl63",
    "file": "DOODLE1.ANS",
    "artist": "joseph crum"
  },
  {
    "pack": "ansicl63",
    "file": "THANKS.ANS",
    "artist": "ernest debakey"
  },
  {
    "pack": "ansicl63",
    "file": "CLIPSHIP.ANS",
    "artist": "l r dennis iii"
  }
];
export const familyAllowed=(pack:string,file:string)=>FAMILY_SHELF.some(p=>p.pack.toLowerCase()===pack.toLowerCase()&&p.file.toLowerCase()===file.toLowerCase());
export const pictureOfDay=(date:Date)=>FAMILY_SHELF[Math.abs(Math.floor(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())/86400000))%Math.max(1,FAMILY_SHELF.length)];
