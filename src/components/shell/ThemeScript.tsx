/** Runs before first paint so there is no light/dark flash. Inline by design. */
const code = `try{var t=localStorage.getItem("rega-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
