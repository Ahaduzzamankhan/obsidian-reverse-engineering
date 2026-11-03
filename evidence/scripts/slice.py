#!/usr/bin/env python
"""Dump a character range from a file, optionally pretty-printing a JS object literal."""
import sys

path, start, end = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
data = open(path, "r", encoding="utf-8", errors="replace").read()
chunk = data[start:end]
if len(sys.argv) > 4 and sys.argv[4] == "--split":
    for part in chunk.replace("{", "{\n").replace("}", "\n}").replace(",", ",\n").split("\n"):
        print(part.strip())
else:
    print(chunk)
