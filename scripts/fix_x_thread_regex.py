from pathlib import Path

path = Path("frontend/app/page.js")
content = path.read_text(encoding="utf-8")
broken = "currentPost.split(/\n\n+/)"
fixed = r"currentPost.split(/\n\n+/)"

if broken not in content:
    raise RuntimeError("Broken multiline X thread separator was not found")

path.write_text(content.replace(broken, fixed, 1), encoding="utf-8")
print("Repaired X thread separator regex.")
