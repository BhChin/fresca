/** sessionStorage key: the intro has played in this tab session. */
export const INTRO_KEY = "fresca-intro-played";

/**
 * Runs before first paint (inlined in <head>). Adds `html.intro` when the intro
 * will play, so CSS can hide the finished hero instead of flashing it.
 */
export const introScript = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('${INTRO_KEY}'))document.documentElement.classList.add('intro')}catch(e){}`;

export function introIsPlaying() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("intro");
}
