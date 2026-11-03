(async () => {
  const keys = ["--background-primary","--background-primary-alt","--background-secondary","--background-secondary-alt","--background-modifier-border","--background-modifier-hover","--background-modifier-active-hover","--text-normal","--text-muted","--text-faint","--text-accent","--interactive-accent","--interactive-accent-hover","--color-red","--color-green","--color-blue","--color-purple","--color-yellow","--color-orange","--color-cyan","--color-pink","--font-text-size","--font-ui-small","--font-ui-medium","--font-ui-large","--h1-size","--h2-size","--h3-size","--radius-s","--radius-m","--radius-l","--radius-xl","--file-line-width","--line-height-normal"];
  const grab = () => {
    const cs = getComputedStyle(document.body);
    const o = {};
    for (const k of keys) o[k] = cs.getPropertyValue(k).trim();
    o._bodyClass = document.body.className.match(/theme-\w+/)?.[0];
    return o;
  };
  const dark = grab();
  app.commands.executeCommandById("theme:toggle-light-dark");
  await new Promise((r) => setTimeout(r, 800));
  const light = grab();
  app.commands.executeCommandById("theme:toggle-light-dark");
  return JSON.stringify({ dark, light }, null, 2);
})();
