"""Audit which pages use BriefingLayout (shared navbar) vs which have their own."""
import os
pages_dir = r"C:\Users\hitan\Downloads\Hump-Yard-Insight (1)\Hump-Yard-Insight\artifacts\hump-yard-intel\src\pages"
for f in sorted(os.listdir(pages_dir)):
    if not f.endswith(".tsx"):
        continue
    path = os.path.join(pages_dir, f)
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    has_bl = "BriefingLayout" in text
    has_header = "<header" in text
    has_nav = "<nav" in text
    status = []
    if has_bl:
        status.append("BriefingLayout")
    if has_header:
        status.append("HAS OWN <header>")
    if has_nav:
        status.append("HAS OWN <nav>")
    if not status:
        status.append("(no header)")
    print(f"  {f:30s}  {', '.join(status)}")
