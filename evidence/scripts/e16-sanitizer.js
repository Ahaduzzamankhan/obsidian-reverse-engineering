(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const f = app.vault.getAbstractFileByPath("Sanitizer.md");
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(f);
  await wait(1200);
  await leaf.view.setState({ mode: "preview" }, { history: false });
  await wait(1800);
  const el = leaf.view.previewMode.containerEl;
  const attrs = [];
  el.querySelectorAll("*").forEach((n) => {
    for (const a of n.attributes) if (/^on/i.test(a.name) || /^javascript:/i.test(a.value)) attrs.push(n.tagName + " " + a.name + "=" + a.value.slice(0, 40));
  });
  return JSON.stringify({
    html: el.innerHTML.replace(/\s+/g, " ").slice(0, 2500),
    dangerousAttributes: attrs,
    hasScript: el.querySelectorAll("script").length,
    iframes: [...el.querySelectorAll("iframe")].map((i) => i.getAttribute("src")),
    imgSrc: [...el.querySelectorAll("img")].map((i) => i.getAttribute("src")),
    xssFlags: { img: !!window.__xss_img, script: !!window.__xss_script, handler: !!window.__xss_handler, svg: !!window.__xss_svg, link: !!window.__xss_link, math: !!window.__xss_math, object: !!window.__xss_object, iframe: !!window.__xss_iframe },
  }, null, 2);
})();
