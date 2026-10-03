from argparse import Namespace
from pathlib import Path

from signalflow.cli import cmd_render


def test_cli_render_uses_supported_python_renderer(tmp_path):
    source = tmp_path / "example.py"
    output = tmp_path / "example.png"
    source.write_text("def hello():\n    return 'signalflow'\n", encoding="utf-8")

    cmd_render(Namespace(file=str(source), out=str(output), lexer="python"))

    assert output.exists()
    assert output.stat().st_size > 0


def test_retired_experimental_runtime_surfaces_stay_absent():
    repo_root = Path(__file__).resolve().parents[1]

    for relative in (
        "go_transport",
        "rust_media_compositor",
        "proto",
        "signalflow/native.py",
        "tests/test_native_shim.py",
    ):
        assert not (repo_root / relative).exists(), f"retired runtime surface returned: {relative}"

    makefile = (repo_root / "Makefile").read_text(encoding="utf-8")
    cli = (repo_root / "signalflow/cli.py").read_text(encoding="utf-8")

    assert "build-go" not in makefile
    assert "build-rust" not in makefile
    assert "signalflow.native" not in cli
    assert "render_code_via_rust" not in cli
