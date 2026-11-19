# Sprint A archive audit

## Method and reproducibility
- 304 files through the existing permanent caching proxy, sequentially at one request/second.
- Every available year 1990–2026 represented (37 years); 76 samples from 1990–96. Text/odd/extensionless entries plus negative picture/program/archive/RIP controls included.
- Corpus and independent rendered references live in `/tmp/dialup-audit`, not the repository. No art copies are committed.
- Run `python3 tools/audit/sample.py`, then `bun tools/audit/baseline.ts` **before changes**, then `bun tools/audit/render.ts` after changes. The baseline preserves each acquired record once.
- Checks cover unknown sequences, SAUCE height, filled right margin/width, blank/uniform output, controls, legacy colors, RIP/Avatar and unsupported SAUCE fonts.
- AnsiLove 4.2.1 installed via Nix. 22 flagged text entries compared; most filled-margin examples differ by 0–0.22 mean RGB levels on their common area. Extra final/minimum terminal rows excluded from that metric.

## Before → after
- 304/304 measured. Automatic flagged files: **91 → 61** (29.9% → 20.1%); this deliberately includes unsupported negative controls and metadata false positives.
- Unknown parser sequence occurrences: **12 flagged files → zero occurrences**.
- After categories: 40 unsupported, 14 filled-margin, 6 height, 1 unexplained binary/control anomaly.
- 1990–96: 8 flagged entries before; 5 intentionally unsupported after, one stale-height metadata flag and one unresolved `ALIVE.TRN`.
- Of 71 early entries not deliberately excluded, **1 unresolved = 1.41%**, below the 2% target. This is the classified sample rate, not an archive-wide guarantee.

## Repairs
- SAUCE width and conservative 80/132/160 inference; genuine VGA50 8x8 with 50 rows.
- Licensed DOS code-page and Amiga font tables, selected by SAUCE name.
- PCBoard, Wildcat-like and pipe color translation; Avatar basic cursor/attribute subset; LF-only normalization.
- Content-based XBin/ADF/IDF and Tundra24 detection; reject image/program/archive signatures.
- Preserve CP437 byte 22 in ANSI instead of misreading it as Avatar. `_A-JOINT.ASC`, `FLUID.ANS` and `CD-QUIT.ANS` now render; two re-shot on the actual CRT.
- ANSI-music strings terminated by byte 14 suppressed as non-display commands; no sampled music playback added.
- Unsupported extension rows excluded by default, with V-to-list count and in-character refusal.

## Remaining failures and limitations
- `ali-0194/ALIVE.TRN`: compressed/encrypted-looking control-heavy data; format unknown. Not claimed fixed.
- `ane-0196/()INFO()`: SAUCE says 25 rows, actual text is one; AnsiLove agrees on one. Metadata false positive.
- Filled last column is not necessarily wrap damage; reference comparisons largely agree, so those flags remain diagnostic rather than failures.
- Later SAUCE row counts can describe blank rows/animations. Six height flags require manual review.
- ANSI music reference semantics differ from ANSI.SYS delete-line semantics; SOUND525 is historical explanatory text, not an art fidelity benchmark.
- RIP graphics deliberately refused; incomplete Avatar commands refused. No claim of complete Avatar/RIP/font support.
- No exhaustive pack crawl, bulk prefetch or independent reference image for every sample. Raw corpus is temporary; rerun acquisition to reproduce.
