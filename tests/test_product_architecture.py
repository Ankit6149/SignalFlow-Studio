from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_retired_python_product_paths_are_absent():
    retired = [
        "signalflow/model/server.py",
        "signalflow/model/adapter.py",
        "signalflow/orchestrator.py",
        "signalflow/launchkit.py",
    ]
    for relative in retired:
        assert not (ROOT / relative).exists(), f"retired parallel product path returned: {relative}"


def test_python_cli_is_utility_only():
    cli = read("signalflow/cli.py")
    for retired in [
        "stub-generate",
        "launch-kit",
        "run_pipeline",
        "FastAPI",
        "uvicorn",
        "CloudStubAdapter",
        "LocalRESTAdapter",
    ]:
        assert retired not in cli


def test_python_requirements_do_not_restore_parallel_web_stack():
    packages = {
        line.strip().lower()
        for line in read("requirements.txt").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    for retired in {"fastapi", "uvicorn", "pydantic", "requests"}:
        assert retired not in packages


def test_nextjs_application_remains_canonical_product():
    assert (ROOT / "frontend/package.json").exists()
    assert (ROOT / "frontend/app/api/launch_kit/route.js").exists()
    assert (ROOT / "frontend/lib/application").is_dir()
    assert (ROOT / "frontend/lib/domain").is_dir()
