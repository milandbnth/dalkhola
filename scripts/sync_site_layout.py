from pathlib import Path
import argparse
import difflib
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
TEMPLATES = ROOT / "templates"

PAGES = {
    "index.html": "home",
    "business.html": "business",
    "education.html": "education",
    "services.html": "services",
    "transport.html": "transport",
}

HEADER_START = "<!-- SHARED-HEADER:START -->"
HEADER_END = "<!-- SHARED-HEADER:END -->"
FAVICON_START = "<!-- SHARED-FAVICON:START -->"
FAVICON_END = "<!-- SHARED-FAVICON:END -->"


def load_template(filename):
    path = TEMPLATES / filename
    if not path.is_file():
        raise FileNotFoundError(f"Missing template: {path}")
    return path.read_text(encoding="utf-8")


def replace_or_insert_header(content, header):
    if HEADER_START in content or HEADER_END in content:
        pattern = re.compile(
            re.escape(HEADER_START) + r".*?" + re.escape(HEADER_END),
            re.DOTALL,
        )
        if not pattern.search(content):
            raise ValueError("Incomplete shared-header markers.")
        return pattern.sub(lambda _: header, content, count=1)

    pattern = re.compile(
        r"<header\b[^>]*>.*?</header\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    updated, count = pattern.subn(lambda _: header, content, count=1)
    if count != 1:
        raise ValueError("Could not find exactly one existing header.")
    return updated


def replace_or_insert_favicon(content, favicon):
    if FAVICON_START in content or FAVICON_END in content:
        pattern = re.compile(
            re.escape(FAVICON_START) + r".*?" + re.escape(FAVICON_END),
            re.DOTALL,
        )
        if not pattern.search(content):
            raise ValueError("Incomplete shared-favicon markers.")
        return pattern.sub(lambda _: favicon, content, count=1)

    pattern = re.compile(r"</head\s*>", re.IGNORECASE)
    updated, count = pattern.subn(
        lambda _: favicon + "\n</head>",
        content,
        count=1,
    )
    if count != 1:
        raise ValueError("Could not find the closing </head> tag.")
    return updated


def build_header(template, active_page):
    result = template
    for page in PAGES.values():
        placeholder = "{{ACTIVE_" + page.upper() + "}}"
        value = 'class="active" aria-current="page"' if page == active_page else ""
        result = result.replace(placeholder, value)

    if "{{ACTIVE_" in result:
        raise ValueError("An active-page placeholder was not replaced.")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Synchronise the shared Dalkhola Online header and favicon."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the changes. Without this option, only show a dry run.",
    )
    args = parser.parse_args()

    try:
        header_template = load_template("header.html")
        favicon_template = load_template("favicon.html")

        for filename, active_page in PAGES.items():
            path = PUBLIC / filename

            if not path.is_file():
                raise FileNotFoundError(f"Missing page: {path}")

            original = path.read_text(encoding="utf-8")
            updated = replace_or_insert_header(
                original,
                build_header(header_template, active_page),
            )
            updated = replace_or_insert_favicon(updated, favicon_template)

            if updated == original:
                print(f"UNCHANGED: {filename}")
                continue

            print(f"\n{'UPDATE' if args.apply else 'DRY RUN'}: {filename}")
            diff = difflib.unified_diff(
                original.splitlines(),
                updated.splitlines(),
                fromfile=filename + " (current)",
                tofile=filename + " (proposed)",
                lineterm="",
            )
            for line in diff:
                print(line)

            if args.apply:
                path.write_text(updated, encoding="utf-8", newline="\n")
                print(f"APPLIED: {filename}")

        if args.apply:
            print("\nLayout synchronisation completed.")
        else:
            print("\nDry run completed. No files were changed.")
            print("Review the changes, then run with --apply to write them.")

    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
