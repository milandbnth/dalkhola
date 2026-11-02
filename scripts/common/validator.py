#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REGISTRY_FILE = ROOT / "config" / "modules.json"


def load_json(path):
    """Load and validate a JSON file."""

    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    except FileNotFoundError:
        raise ValueError(f"Missing file: {path.relative_to(ROOT)}")

    except json.JSONDecodeError as error:
        raise ValueError(
            f"Invalid JSON in {path.relative_to(ROOT)}: "
            f"line {error.lineno}, column {error.colno}: {error.msg}"
        )


def validate_registry(registry):
    """Validate the central module registry."""

    if not isinstance(registry, dict):
        raise ValueError("Registry must be a JSON object.")

    if not isinstance(registry.get("portal"), dict):
        raise ValueError("Missing or invalid portal configuration.")

    if not isinstance(registry.get("modules"), list):
        raise ValueError("'modules' must be a JSON array.")

    if not registry["modules"]:
        raise ValueError("No modules registered.")

    seen_ids = set()

    for module in registry["modules"]:
        if not isinstance(module, dict):
            raise ValueError("Each module must be a JSON object.")

        required = [
            "id",
            "title",
            "page",
            "enabled",
            "data_mode",
            "manual_data",
            "automated_data",
            "overrides",
            "published_data"
        ]

        for field in required:
            if field not in module:
                raise ValueError(
                    f"Module is missing required field: {field}"
                )

        module_id = module["id"]

        if not isinstance(module_id, str) or not module_id.strip():
            raise ValueError("Module ID must be a non-empty string.")

        if module_id in seen_ids:
            raise ValueError(f"Duplicate module ID: {module_id}")

        seen_ids.add(module_id)

        if not isinstance(module["enabled"], bool):
            raise ValueError(
                f"Module '{module_id}': enabled must be true or false."
            )

        if module["data_mode"] not in ("manual", "automated", "hybrid"):
            raise ValueError(
                f"Module '{module_id}': invalid data_mode."
            )


def validate_modules(registry):
    """Validate the data files belonging to each enabled module."""

    errors = []

    for module in registry["modules"]:

        if not module["enabled"]:
            print(f"SKIPPED: {module['id']} (disabled)")
            continue

        print(f"\nChecking module: {module['id']}")

        files = [
            ("manual_data", True),
            ("automated_data", False),
            ("overrides", False)
        ]

        for field, required in files:

            relative_path = module[field]
            path = ROOT / relative_path

            if not path.exists():

                if required:
                    errors.append(
                        f"{module['id']}: missing manual data: {relative_path}"
                    )

                else:
                    print(f"  OPTIONAL FILE MISSING: {relative_path}")

                continue

            try:
                data = load_json(path)

                if not isinstance(data, (dict, list)):
                    raise ValueError(
                        "Top-level JSON must be an object or array."
                    )

                print(f"  OK: {relative_path}")

            except ValueError as error:
                errors.append(str(error))

    return errors


def main():

    print("================================")
    print("DALKHOLA PORTAL DATA VALIDATOR")
    print("================================")

    try:
        registry = load_json(REGISTRY_FILE)

        validate_registry(registry)

        print("\nModule registry: VALID")

        errors = validate_modules(registry)

        if errors:
            print("\nVALIDATION FAILED")

            for error in errors:
                print(f"ERROR: {error}")

            sys.exit(1)

        print("\n================================")
        print("ALL MODULES VALIDATED SUCCESSFULLY")
        print("================================")

    except ValueError as error:
        print(f"\nVALIDATION FAILED: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()