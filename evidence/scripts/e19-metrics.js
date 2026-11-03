(() => {
  const box = (sel, label) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      label,
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      y: Math.round(r.y),
      padding: cs.padding,
      margin: cs.margin,
      font: cs.font ? cs.font.replace(/\s+/g, " ") : null,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      color: cs.color,
      bg: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      border: cs.border,
    };
  };
  const out = [
    box(".workspace-ribbon.mod-primary", "left ribbon"),
    box(".workspace-split.mod-left-split", "left sidebar"),
    box(".workspace-tab-header-container", "tab bar"),
    box(".workspace-tab-header.is-active", "active tab"),
    box(".view-header", "view header (breadcrumb)"),
    box(".view-content", "view content"),
    box(".status-bar", "status bar"),
    box(".cm-editor", "editor root"),
    box(".cm-line", "editor line"),
    box(".inline-title", "inline title"),
    box(".markdown-preview-view .el-h1, .markdown-preview-sizer h1", "h1"),
    box(".markdown-preview-sizer p", "body paragraph"),
    box(".nav-file-title", "explorer item"),
    box(".search-input-container input", "search input"),
    box(".status-bar-item", "status item"),
    box(".app-container", "app container"),
  ];
  const bodyStyles = getComputedStyle(document.body);
  return JSON.stringify({
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    boxes: out,
    tokens: {
      ribbonWidth: bodyStyles.getPropertyValue("--ribbon-width"),
      titlebarHeight: bodyStyles.getPropertyValue("--titlebar-height"),
      tabHeight: bodyStyles.getPropertyValue("--tab-height"),
      headerHeight: bodyStyles.getPropertyValue("--header-height"),
      inputHeight: bodyStyles.getPropertyValue("--input-height"),
      fontText: bodyStyles.getPropertyValue("--font-text-size"),
      fontUiSmall: bodyStyles.getPropertyValue("--font-ui-small"),
      fontUiMedium: bodyStyles.getPropertyValue("--font-ui-medium"),
      lineHeightNormal: bodyStyles.getPropertyValue("--line-height-normal"),
      radiusS: bodyStyles.getPropertyValue("--radius-s"),
      radiusM: bodyStyles.getPropertyValue("--radius-m"),
      radiusL: bodyStyles.getPropertyValue("--radius-l"),
      readableLineWidth: bodyStyles.getPropertyValue("--file-line-width"),
      indentationGuide: bodyStyles.getPropertyValue("--indentation-guide-width"),
    },
  }, null, 2);
})();
