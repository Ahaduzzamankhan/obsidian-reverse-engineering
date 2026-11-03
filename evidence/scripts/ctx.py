#!/usr/bin/env python
"""Literal-substring window dump for minified bundles.

Usage: ctx.py <file> <literal> [--before N] [--after N] [--max K]
"""
import sys

path = sys.argv[1]
needle = sys.argv[2]
before, after, maximum = 300, 500, 10
i = 3
while i < len(sys.argv):
    if sys.argv[i] == "--before":
        before = int(sys.argv[i + 1]); i += 2
    elif sys.argv[i] == "--after":
        after = int(sys.argv[i + 1]); i += 2
    elif sys.argv[i] == "--max":
        maximum = int(sys.argv[i + 1]); i += 2
    else:
        i += 1

data = open(path, "r", encoding="utf-8", errors="replace").read()
pos, found = 0, 0
while found < maximum:
    idx = data.find(needle, pos)
    if idx < 0:
        break
    found += 1
    start = max(0, idx - before)
    end = min(len(data), idx + len(needle) + after)
    print("=== #%d @ %d ===" % (found, idx))
    print(data[start:end].replace("\r", "").replace("\n", "\\n"))
    print()
    pos = idx + len(needle)
if not found:
    print("(no match for %r)" % needle)
