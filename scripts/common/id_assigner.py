import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = ROOT / "config/modules.json"
REGISTRY_FILE = ROOT / "data/registry/global-ids.json"

PREFIXES = {
    "home": "HOM",
    "business": "BIZ",
    "education": "EDU",
    "services": "SRV",
    "transport": "TRN",
}

ID_PATTERN = re.compile(r"^DLK-([A-Z]{3})-(\d{6})$")
IDENTITY_FIELDS = {"name", "title", "station"}


def read_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.write("\n")


def load_registry():
    if not REGISTRY_FILE.exists():
        return {
            "version": 1,
            "counters": {},
            "legacy_ids": {},
            "records": {},
        }

    registry = read_json(REGISTRY_FILE)

    if registry.get("version") != 1:
        raise ValueError("Unsupported global ID registry version.")

    for key in ("counters", "legacy_ids", "records"):
        if not isinstance(registry.get(key), dict):
            raise ValueError(f"Registry field '{key}' must be an object.")

    return registry


def module_sources(config):
    modules = config.get("modules", [])

    if isinstance(modules, dict):
        modules = [
            {"id": module_id, **settings}
            for module_id, settings in modules.items()
        ]

    for module in modules:
        module_id = module.get("id")

        if module_id not in PREFIXES:
            raise ValueError(
                f"Module '{module_id}' has no configured ID prefix."
            )

        source = module.get("manual_data")
        if not source:
            continue

        path = ROOT / source

        if path.exists():
            yield module_id, path
        else:
            print(f"SKIP: {source} does not exist")


def is_entity(record):
    return any(
        isinstance(record.get(field), str) and record[field].strip()
        for field in IDENTITY_FIELDS
    )


def allocate_id(module_id, registry, reserved):
    prefix = PREFIXES[module_id]
    current = int(registry["counters"].get(prefix, 0))

    while True:
        current += 1
        candidate = f"DLK-{prefix}-{current:06d}"

        if candidate not in reserved:
            registry["counters"][prefix] = current
            reserved.add(candidate)
            return candidate


def validate_registry(registry):
    for record_id, details in registry["records"].items():
        match = ID_PATTERN.fullmatch(record_id)

        if not match:
            raise ValueError(
                f"Invalid ID in registry: {record_id}"
            )

        if not isinstance(details, dict):
            raise ValueError(
                f"Invalid registry entry for {record_id}."
            )

        module_id = details.get("module")

        if module_id not in PREFIXES:
            raise ValueError(
                f"Unknown module in registry entry {record_id}."
            )

        if match.group(1) != PREFIXES[module_id]:
            raise ValueError(
                f"Wrong module prefix in registry entry {record_id}."
            )

    for legacy_key, assigned_id in registry["legacy_ids"].items():
        if assigned_id not in registry["records"]:
            raise ValueError(
                f"Legacy mapping '{legacy_key}' points to "
                f"unregistered ID '{assigned_id}'."
            )

        module_id = legacy_key.split(":", 1)[0]

        if module_id not in PREFIXES:
            raise ValueError(
                f"Invalid module in legacy mapping '{legacy_key}'."
            )

        if registry["records"][assigned_id]["module"] != module_id:
            raise ValueError(
                f"Legacy mapping '{legacy_key}' points to "
                f"an ID belonging to another module."
            )

    for module_id, prefix in PREFIXES.items():
        try:
            counter = int(registry["counters"].get(prefix, 0))
        except (TypeError, ValueError):
            raise ValueError(f"Invalid counter for prefix {prefix}.")

        if counter < 0:
            raise ValueError(f"Negative counter for prefix {prefix}.")

        highest = max(
            (
                int(ID_PATTERN.fullmatch(record_id).group(2))
                for record_id in registry["records"]
                if ID_PATTERN.fullmatch(record_id).group(1) == prefix
            ),
            default=0,
        )

        if counter < highest:
            raise ValueError(
                f"Counter for {prefix} is {counter}, "
                f"but registry already contains ID number {highest}."
            )


def assign_record(
    record,
    module_id,
    record_path,
    registry,
    seen,
    reserved,
    changes,
):
    old_id = record.get("id")
    prefix = PREFIXES[module_id]

    if isinstance(old_id, str) and ID_PATTERN.fullmatch(old_id):
        assigned_id = old_id
        match = ID_PATTERN.fullmatch(assigned_id)

        if match.group(1) != prefix:
            raise ValueError(
                f"ID '{assigned_id}' at {record_path} "
                f"has the wrong prefix for module '{module_id}'."
            )

        existing = registry["records"].get(assigned_id)

        if existing is None:
            changes.append(
                ("REGISTER", record_path, old_id, assigned_id)
            )
        elif existing.get("module") != module_id:
            raise ValueError(
                f"ID '{assigned_id}' belongs to module "
                f"'{existing.get('module')}', not '{module_id}'."
            )

    elif old_id is not None and str(old_id).strip():
        legacy_key = f"{module_id}:{old_id}"
        assigned_id = registry["legacy_ids"].get(legacy_key)

        if assigned_id is None:
            assigned_id = allocate_id(module_id, registry, reserved)
            registry["legacy_ids"][legacy_key] = assigned_id

        changes.append(("MIGRATE", record_path, old_id, assigned_id))

    else:
        assigned_id = allocate_id(module_id, registry, reserved)
        changes.append(("ASSIGN", record_path, None, assigned_id))

    if assigned_id in seen:
        raise ValueError(
            f"Duplicate ID '{assigned_id}' found at {record_path}; "
            f"first used at {seen[assigned_id]}."
        )

    seen[assigned_id] = record_path
    reserved.add(assigned_id)
    record["id"] = assigned_id

    registry["records"].setdefault(
        assigned_id,
        {
            "module": module_id,
            "source": record_path,
        },
    )

    # Refresh the source location when records move within a module.
    registry["records"][assigned_id]["source"] = record_path


def visit(
    value,
    module_id,
    path,
    registry,
    seen,
    reserved,
    changes,
    parent_key=None,
):
    if isinstance(value, dict):
        if parent_key in {"metadata", "city_summary"}:
            return

        if parent_key == "railway" and is_entity(value):
            assign_record(
                value, module_id, path,
                registry, seen, reserved, changes
            )

        for key, child in value.items():
            visit(
                child,
                module_id,
                f"{path}.{key}",
                registry,
                seen,
                reserved,
                changes,
                parent_key=key,
            )

    elif isinstance(value, list):
        for index, item in enumerate(value):
            item_path = f"{path}[{index}]"

            if isinstance(item, dict) and is_entity(item):
                assign_record(
                    item, module_id, item_path,
                    registry, seen, reserved, changes
                )

            visit(
                item,
                module_id,
                item_path,
                registry,
                seen,
                reserved,
                changes,
                parent_key=parent_key,
            )


def main():
    parser = argparse.ArgumentParser(
        description="Assign and verify persistent global portal IDs."
    )

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--check", action="store_true")

    args = parser.parse_args()

    if not CONFIG_FILE.exists():
        print(f"ERROR: Config not found: {CONFIG_FILE}")
        return 1

    try:
        config = read_json(CONFIG_FILE)
        registry = load_registry()
        validate_registry(registry)

        seen = {}
        changes = []
        documents = []

        # Reserve all registered IDs, including IDs of deleted records.
        reserved = set(registry["records"])

        for module_id, path in module_sources(config):
            data = read_json(path)
            documents.append((path, data))

            visit(
                data,
                module_id,
                str(path.relative_to(ROOT)).replace("\\", "/"),
                registry,
                seen,
                reserved,
                changes,
            )

        if args.check:
            if changes:
                print("CHECK FAILED: ID or registry changes are required.")

                for action, path, old_id, new_id in changes:
                    print(
                        f"  {action}: {path}: "
                        f"{old_id!r} -> {new_id}"
                    )

                return 1

            print(
                f"CHECK PASSED: {len(seen)} records have "
                "valid, unique, registered IDs."
            )
            return 0

        if not args.apply:
            print("DRY RUN — no files were changed.")
            print()

            for action, path, old_id, new_id in changes:
                print(f"{action}: {path}")
                print(f"  {old_id!r} -> {new_id}")

            print()
            print(f"Records inspected: {len(seen)}")
            print(f"Changes required: {len(changes)}")
            print("Run with --apply to write changes.")
            return 0

        # Validate the final in-memory registry before writing anything.
        validate_registry(registry)

        for path, data in documents:
            write_json(path, data)

        write_json(REGISTRY_FILE, registry)

        print(f"Updated {len(documents)} source files.")
        print(f"Updated registry: {REGISTRY_FILE.relative_to(ROOT)}")
        print(f"Records with unique IDs: {len(seen)}")

        return 0

    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
