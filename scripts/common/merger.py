#!/usr/bin/env python3

import json
import sys
from pathlib import Path
from copy import deepcopy

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_FILE = ROOT / "config" / "modules.json"


def load_json(path, required=False):
    if not path.exists():
        if required:
            raise FileNotFoundError(
                f"Required file missing: {path.relative_to(ROOT)}"
            )
        return {}

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.write("\n")


def merge_values(manual, automated):
    """
    Recursively merge data.

    Manual values take priority.
    Lists of records are merged using their IDs.
    """

    if isinstance(manual, dict) and isinstance(automated, dict):
        result = deepcopy(automated)

        for key, manual_value in manual.items():
            if key in result:
                result[key] = merge_values(
                    manual_value,
                    result[key]
                )
            else:
                result[key] = deepcopy(manual_value)

        return result

    if isinstance(manual, list) and isinstance(automated, list):

        if all(
            isinstance(item, dict) and "id" in item
            for item in manual + automated
        ):
            result = {
                item["id"]: deepcopy(item)
                for item in automated
            }

            for item in manual:
                record_id = item["id"]

                if record_id in result:
                    result[record_id] = merge_values(
                        item,
                        result[record_id]
                    )
                else:
                    result[record_id] = deepcopy(item)

            return list(result.values())

        # Lists without stable IDs are kept from manual data.
        return deepcopy(manual)

    # Manual scalar values take priority.
    return deepcopy(manual)


def apply_overrides(data, overrides):
    """
    Apply explicit override values recursively.

    For lists of records, match records by ID.
    An override record with {"_delete": true} removes that ID.
    """

    if isinstance(data, dict) and isinstance(overrides, dict):
        result = deepcopy(data)

        for key, override_value in overrides.items():
            if key in result:
                result[key] = apply_overrides(
                    result[key],
                    override_value
                )
            else:
                result[key] = deepcopy(override_value)

        return result

    if isinstance(data, list) and isinstance(overrides, list):
        if all(
            isinstance(item, dict) and "id" in item
            for item in data + overrides
        ):
            result = {
                item["id"]: deepcopy(item)
                for item in data
            }

            for item in overrides:
                record_id = item["id"]

                if item.get("_delete") is True:
                    result.pop(record_id, None)
                    continue

                clean_override = {
                    key: value
                    for key, value in item.items()
                    if key != "_delete"
                }

                if record_id in result:
                    result[record_id] = apply_overrides(
                        result[record_id],
                        clean_override
                    )
                else:
                    result[record_id] = clean_override

            return list(result.values())

        return deepcopy(overrides)

    return deepcopy(overrides)


def merge_module(module):
    module_id = module["id"]

    print(f"\nMerging module: {module_id}")

    manual_path = ROOT / module["manual_data"]
    automated_path = ROOT / module["automated_data"]
    overrides_path = ROOT / module["overrides"]
    output_path = ROOT / module["published_data"]

    manual = load_json(manual_path, required=True)
    automated = load_json(automated_path)
    overrides = load_json(overrides_path)

    merged = merge_values(manual, automated)
    final_data = apply_overrides(merged, overrides)

    save_json(output_path, final_data)

    print(f"  Manual data: OK")
    print(f"  Automated data: {'FOUND' if automated_path.exists() else 'NOT FOUND'}")
    print(f"  Overrides: OK")
    print(f"  Published: {output_path.relative_to(ROOT)}")


def main():
    print("================================")
    print("DALKHOLA PORTAL DATA MERGER")
    print("================================")

    try:
        registry = load_json(REGISTRY_FILE, required=True)

        for module in registry["modules"]:
            if not module["enabled"]:
                print(f"\nSkipping disabled module: {module['id']}")
                continue

            merge_module(module)

        print("\n================================")
        print("ALL MODULES MERGED SUCCESSFULLY")
        print("================================")

    except (ValueError, OSError, KeyError) as error:
        print(f"\nMERGE FAILED: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()