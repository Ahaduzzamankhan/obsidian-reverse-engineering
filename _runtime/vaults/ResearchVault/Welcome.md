---
title: Welcome
tags:
  - research/obsidian
  - demo
aliases:
  - Home
status: active
priority: 8
progress: 42
reviewed: 2026-10-01
publish: false
cssclasses:
  - wide
---

# Welcome to the vault

This note exercises most Markdown features so the parser and renderer can be observed.

## Links

- Wikilink to a note: [[Alpha Renamed]]
- Wikilink with alias: [[Beta|the beta project]]
- Heading link: [[Alpha Renamed#Section One]]
- Block link: [[Alpha Renamed#^block-abc123]]
- External link: [Obsidian](https://obsidian.md)
- Unresolved link: [[This note does not exist]]

## Formatting

**Bold**, *italic*, ~~strikethrough~~, ==highlight==, `inline code`, <sup>sup</sup> and a footnote[^1].

> [!note] Callout title
> Callouts are blockquotes with a type.

- [ ] unchecked task
- [x] checked task

| Column A | Column B |
| -------- | -------- |
| one      | two      |

```js
const answer = 42;
console.log(`answer=${answer}`);
```

$$
e^{i\pi} + 1 = 0
$$

![[projects.png]]

![[Beta]]

%% This is a comment block that should not render %%

^block-abc123

[^1]: Footnote text.
