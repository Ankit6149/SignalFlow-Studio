from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "frontend/lib/domain/contracts.mjs"
content = PATH.read_text(encoding="utf-8")

old = 'const FORBIDDEN_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|password|authorization|cookie|database|dbclient|request|response)/i;\n'
new = '''const FORBIDDEN_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|password|authorization|cookie|database|dbclient)/i;
const FORBIDDEN_FRAMEWORK_FIELD = /^(request|response|httpRequest|httpResponse|req|res)$/i;
'''
if content.count(old) != 1:
    raise RuntimeError(f"domain forbidden-field anchor count: {content.count(old)}")
content = content.replace(old, new, 1)

old_check = '      if (FORBIDDEN_FIELD.test(key)) {\n'
new_check = '      if (FORBIDDEN_FIELD.test(key) || FORBIDDEN_FRAMEWORK_FIELD.test(key)) {\n'
if content.count(old_check) != 1:
    raise RuntimeError(f"domain forbidden-field check anchor count: {content.count(old_check)}")
content = content.replace(old_check, new_check, 1)

PATH.write_text(content, encoding="utf-8")
