#!/usr/bin/env python3

import json
from pathlib import Path

# Project root
ROOT = Path(__file__).resolve().parent.parent

# Source files
CITY_FILE = ROOT / "data" / "dalkhola.json"
SERVICES_FILE = ROOT / "data" / "services.json"

# Destination
MODULES_DIR = ROOT / "data" / "modules"


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_module(module, content):
    destination = (
        MODULES_DIR
        / module
        / "manual"
        / "content.json"
    )

    destination.parent.mkdir(parents=True, exist_ok=True)

    with open(destination, "w", encoding="utf-8") as file:
        json.dump(
            content,
            file,
            indent=2,
            ensure_ascii=False
        )
        file.write("\n")

    print(f"Created: {destination.relative_to(ROOT)}")


def main():

    print("Loading original JSON files...")

    city = load_json(CITY_FILE)
    services = load_json(SERVICES_FILE)

    metadata = city.get("metadata", {})

    # 1. HOME MODULE
    home = {
        "metadata": metadata,
        "overview": city.get("overview", {})
    }

    # 2. BUSINESS MODULE
    business = {
        "metadata": metadata,
        "business": city.get("business", {})
    }

    # 3. EDUCATION MODULE
    education = {
        "metadata": metadata,
        "education": city.get("education", {})
    }

    # 4. SERVICES MODULE
    # Preserve the detailed services dataset and its metadata.
    services_data = dict(services)

    # Also preserve the services summary from dalkhola.json.
    services_data["city_summary"] = city.get("services", {})

    # 5. TRANSPORT MODULE
    transport = {
        "metadata": metadata,
        "transport": city.get("transport", {})
    }

    print("\nCreating module datasets...\n")

    save_module("home", home)
    save_module("business", business)
    save_module("education", education)
    save_module("services", services_data)
    save_module("transport", transport)

    print("\n--------------------------------")
    print("Portal data split completed!")
    print("--------------------------------")

    print("\nOriginal files remain unchanged:")
    print("  data/dalkhola.json")
    print("  data/services.json")

    print("\nNew module datasets are in:")
    print("  data/modules/")


if __name__ == "__main__":
    main()