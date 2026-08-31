#!/usr/bin/env python3
"""Rewrites the active API_BASE_URL line in mobile/src/constants.ts.

Called by cloudflared-tunnel.sh every time the quick tunnel (re)starts and
gets a new https://<random-words>.trycloudflare.com URL. Keeps at most one
commented-out previous URL so the file doesn't accumulate an ever-growing
stack of dead tunnel comments across restarts.
"""
import re
import sys

ACTIVE_LINE_RE = re.compile(r"^export const API_BASE_URL = '.*';\s*$")
DEAD_COMMENT_RE = re.compile(r"^// export const API_BASE_URL = '.*';\s*$")


def main() -> int:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <constants.ts path> <new url>", file=sys.stderr)
        return 1

    path, new_url = sys.argv[1], sys.argv[2]
    with open(path) as f:
        lines = f.readlines()

    active_index = next((i for i, l in enumerate(lines) if ACTIVE_LINE_RE.match(l)), None)
    if active_index is None:
        print(f"no active API_BASE_URL line found in {path}", file=sys.stderr)
        return 1

    old_line = lines[active_index].rstrip("\n")
    if f"'{new_url}'" in old_line:
        print(f"constants.ts already points at {new_url}, no change needed")
        return 0

    # Drop any previously dead-tunnel comment lines directly above the active
    # line, then leave exactly one behind (the URL we're replacing now).
    kept = []
    for l in lines[:active_index]:
        if not DEAD_COMMENT_RE.match(l):
            kept.append(l)
    kept.append(f"// {old_line}\n")

    new_active_line = f"export const API_BASE_URL = '{new_url}';\n"

    result = kept + [new_active_line] + lines[active_index + 1:]
    with open(path, "w") as f:
        f.writelines(result)

    print(f"constants.ts updated: {old_line.strip()} -> {new_active_line.strip()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
