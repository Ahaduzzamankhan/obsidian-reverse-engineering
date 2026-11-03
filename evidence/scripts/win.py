#!/usr/bin/env python
"""Print character windows around regex matches in (minified) JS files.

Usage: win.py <file> <regex> [--before N] [--after N] [--max K] [--merge]
Merges overlapping windows and caps output at N matches.
"""
import re
import sys


def main() -> None:
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        sys.exit(2)
    path, pattern = args[0], args[1]
    before, after, maximum = 200, 400, 20
    i = 2
    while i < len(args):
        if args[i] == "--before":
            before = int(args[i + 1]); i += 2
        elif args[i] == "--after":
            after = int(args[i + 1]); i += 2
        elif args[i] == "--max":
            maximum = int(args[i + 1]); i += 2
        else:
            i += 1
    data = open(path, "r", encoding="utf-8", errors="replace").read()
    spans = []
    for m in re.finditer(pattern, data):
        spans.append((max(0, m.start() - before), min(len(data), m.end() + after)))
        if len(spans) >= maximum:
            break
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1] + 20:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    for n, (s, e) in enumerate(merged, 1):
        print("=== match %d @ %d ===" % (n, s))
        print(data[s:e].replace("\n", "\\n"))
        print()


if __name__ == "__main__":
    main()
