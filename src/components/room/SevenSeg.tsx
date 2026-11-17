// A seven-segment digit drawn as SVG. Unlit segments stay faintly visible, like real LED glass.
const SEGS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
  "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", " ": "",
};
const PATHS: Record<string, string> = {
  a: "M3 1 L13 1 L11 3 L5 3 Z", b: "M13.6 1.8 L13.6 11 L12 12 L11.6 3.6 Z", c: "M13.6 13 L13.6 22.2 L11.6 20.4 L12 12.6 Z",
  d: "M3 23 L13 23 L11 21 L5 21 Z", e: "M2.4 13 L2.4 22.2 L4.4 20.4 L4 12.6 Z", f: "M2.4 1.8 L2.4 11 L4 12 L4.4 3.6 Z",
  g: "M3.4 12 L5 10.9 L11 10.9 L12.6 12 L11 13.1 L5 13.1 Z",
};
export function SevenSeg({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`seg ${className}`} aria-hidden>
      {[...value].map((ch, i) => ch === ":" ? (
        <svg key={i} viewBox="0 0 5 24" className="seg-colon"><circle cx="2.5" cy="8" r="1.3" /><circle cx="2.5" cy="16" r="1.3" /></svg>
      ) : (
        <svg key={i} viewBox="0 0 16 24" className="seg-digit">
          {Object.entries(PATHS).map(([k, d]) => <path key={k} d={d} className={(SEGS[ch] ?? "").includes(k) ? "on" : "off"} />)}
        </svg>
      ))}
    </span>
  );
}
