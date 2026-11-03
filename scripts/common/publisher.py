import json
import subprocess
import sys
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = ROOT / "config" / "modules.json"
PUBLIC_DIR = ROOT / "public"
REGISTRY_OUTPUT = PUBLIC_DIR / "data" / "modules.json"


def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def run_script(script_name, *args):
    script_path = ROOT / "scripts" / "common" / script_name

    print(f"\nRunning {script_name} {' '.join(args)}...")

    result = subprocess.run(
        [sys.executable, str(script_path), *args],
        cwd=ROOT
    )

    if result.returncode != 0:
        raise RuntimeError(f"{script_name} failed.")


def get_public_data_url(published_path):
    """
    Convert a published file path into a GitHub Pages URL.
    Example:
    public/data/modules/home.json
    becomes:
    /data/modules/home.json
    """

    relative_path = Path(published_path)

    if relative_path.is_absolute():
        raise ValueError(
            f"Published path must be relative: {published_path}"
        )

    resolved_path = (ROOT / relative_path).resolve()

    try:
        public_relative = resolved_path.relative_to(PUBLIC_DIR.resolve())
    except ValueError:
        raise ValueError(
            f"Published file must be inside public/: {published_path}"
        )

    return "/" + PurePosixPath(public_relative.as_posix()).as_posix()


def verify_published_modules(modules):
    print("\nVerifying published module files...")

    for module in modules:
        if not module.get("enabled", False):
            continue

        published_path = ROOT / module["published_data"]

        if not published_path.is_file():
            raise FileNotFoundError(
                f"Published data missing for module "
                f"'{module['id']}': {published_path}"
            )

        data = load_json(published_path)

        if not isinstance(data, (dict, list)):
            raise ValueError(
                f"Invalid published JSON structure: {published_path}"
            )

        print(f"  OK: {module['id']}")


def generate_public_registry(config):
    portal = config["portal"]
    modules = config["modules"]

    public_modules = []

    for module in modules:
        public_modules.append({
            "id": module["id"],
            "title": module["title"],
            "page": module["page"],
            "enabled": module["enabled"],
            "data_url": get_public_data_url(
                module["published_data"]
            )
        })

    registry = {
        "portal": {
            "name": portal["name"],
            "version": portal["version"]
        },
        "modules": public_modules
    }

    REGISTRY_OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary_file = REGISTRY_OUTPUT.with_suffix(".tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(
            registry,
            file,
            indent=2,
            ensure_ascii=False
        )
        file.write("\n")

    temporary_file.replace(REGISTRY_OUTPUT)

    print(f"\nPublic registry generated: {REGISTRY_OUTPUT}")


def main():
    print("=" * 50)
    print("DALKHOLA ONLINE - STATIC PUBLISHER")
    print("=" * 50)

    if not CONFIG_FILE.is_file():
        raise FileNotFoundError(
            f"Module configuration not found: {CONFIG_FILE}"
        )

    config = load_json(CONFIG_FILE)

    run_script("validator.py")
    run_script("id_assigner.py", "--check")
    run_script("merger.py")

    verify_published_modules(config["modules"])
    generate_public_registry(config)

    print("\n" + "=" * 50)
    print("PORTAL DATA PUBLISHED SUCCESSFULLY")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as error:
        print(f"\nPUBLISHING FAILED: {error}")
        sys.exit(1)