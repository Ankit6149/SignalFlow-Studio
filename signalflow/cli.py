"""Narrow developer utilities for SignalFlow.

The production product is the Next.js application.  This CLI intentionally
contains only local repository/media utilities; it is not a second generation
API, model server, or launch pipeline.
"""

import argparse
import sys
from pathlib import Path

from signalflow.compositor.image_renderer import ImageRenderer
from signalflow.compositor.terminal_recorder import TerminalRecorder
from signalflow.ingestion.snr import SNRScorer
from signalflow.ingestion.walker import DirectoryWalker
from signalflow.native import find_rust_renderer, render_code_via_rust


def cmd_scan(args):
    root = Path(args.repo)
    if not root.exists():
        print(f"Path not found: {root}")
        sys.exit(2)

    files = list(DirectoryWalker(root).walk())
    scored = SNRScorer().score_files(files)
    scored_sorted = sorted(scored.items(), key=lambda item: item[1], reverse=True)

    print(f"Scanned {len(files)} files; top {args.top} by SNR:\n")
    for path, score in scored_sorted[: args.top]:
        print(f"{score:.3f}\t{path}")


def cmd_render(args):
    code = Path(args.file).read_text(encoding="utf-8")
    out_path = Path(args.out)

    if find_rust_renderer() is not None:
        try:
            out = render_code_via_rust(code, out_path)
            print(f"Wrote code image via Rust renderer to: {out}")
            return
        except Exception:
            pass

    out = ImageRenderer().render_code(code, lexer_name=args.lexer, out_path=out_path)
    print(f"Wrote code image to: {out}")


def cmd_record(args):
    out = TerminalRecorder().record(args.commands, Path(args.out))
    print(f"Wrote terminal video to: {out}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="SignalFlow local utility CLI (scan/render/record only)"
    )
    sub = parser.add_subparsers(dest="cmd")

    p_scan = sub.add_parser("scan")
    p_scan.add_argument("--repo", required=True)
    p_scan.add_argument("--top", type=int, default=10)

    p_render = sub.add_parser("render")
    p_render.add_argument("--file", required=True, help="Source code file to render")
    p_render.add_argument("--lexer", required=False)
    p_render.add_argument("--out", required=False, default="out.png")

    p_record = sub.add_parser("record")
    p_record.add_argument(
        "--commands",
        nargs="+",
        required=True,
        help="Commands to run sequentially (shell)",
    )
    p_record.add_argument("--out", required=False, default="out.mp4")

    args = parser.parse_args(argv)
    if args.cmd == "scan":
        cmd_scan(args)
    elif args.cmd == "render":
        cmd_render(args)
    elif args.cmd == "record":
        cmd_record(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
