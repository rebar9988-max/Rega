import { HONEYPOT_FIELD } from "./constants";

/** Hidden trap field for bots: off-screen (not display:none), skipped by keyboards and assistive technology. */
export function Honeypot({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-0 w-0 overflow-hidden">
      <label>
        {label}
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
