
#!/usr/bin/env python3

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

INPUT_FILE = ROOT / "businesses.json"
MANUAL_FILE = ROOT / "data/modules/business/manual/content.json"
AUTOMATED_FILE = ROOT / "data/modules/business/automated/content.json"

SOURCE = "apify_google_maps"

KEYWORDS = {
    "eat": [
        "restaurant", "dhaba", "hotel", "cafe", "coffee",
        "food", "sweet", "bakery", "biryani", "dining",
        "fast food", "pizza", "tea stall", "sweets"
    ],
    "entertain": [
        "cinema", "movie", "park", "gaming", "theatre",
        "entertainment", "club", "amusement"
    ],
    "shop": [
        "shop", "store", "mart", "market", "supermarket",
        "mobile", "fashion", "garments", "clothing",
        "hardware", "jewellers", "jewelry", "electronics",
        "pharmacy", "medical", "furniture", "traders",
        "agency", "showroom", "wholesale"
    ]
}


def load_json(path, required=False):
    if not path.exists():
        if required:
            raise FileNotFoundError(f"Missing file: {path}")
        return {}

    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Invalid JSON in {path}: line {error.lineno}, "
            f"column {error.colno}"
        )


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")

    with temporary.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.write("\n")

    temporary.replace(path)


def classify_section(name):
    value = name.lower()

    for section in ("eat", "entertain", "shop"):
        if any(word in value for word in KEYWORDS[section]):
            return section

    return "miscellaneous"


def make_id(name, address, reserved):
    """
    Generate a repeatable ID.
    The high numeric range avoids the existing manual IDs.
    """

    identity = f"{name.strip().lower()}|{address.strip().lower()}"

    salt = 0

    while True:
        raw = f"{identity}|{salt}".encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()

        number = 100000 + (int(digest[:12], 16) % 900000)
        record_id = f"DLK-BIZ-{number:06d}"

        if record_id not in reserved:
            reserved.add(record_id)
            return record_id

        salt += 1


def extract_record(item, reserved):
    name = str(item.get("name") or "").strip()

    location = item.get("location") or {}
    if not isinstance(location, dict):
        location = {}

    address = str(location.get("address") or "").strip()

    if not name or not address:
        return None

    try:
        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
    except (KeyError, TypeError, ValueError):
        return None

    photo_url = item.get("photo_url")
    if not isinstance(photo_url, str) or not photo_url.startswith("https://"):
        photo_url = None

    record_id = make_id(name, address, reserved)

    return {
        "id": record_id,
        "name": name,
        "category": classify_section(name).replace("_", " ").title(),
        "section": classify_section(name),
        "area": address,
        "address": address,
        "photo_url": photo_url,
        "latitude": latitude,
        "longitude": longitude,
        "source": SOURCE,
        "verified": False,
        "verification_status": "unverified"
    }


def main():
    parser = argparse.ArgumentParser(
        description="Import filtered Apify businesses into the business module."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview the import without changing any files."
    )
    args = parser.parse_args()

    try:
        raw = load_json(INPUT_FILE, required=True)
        manual = load_json(MANUAL_FILE, required=True)
        automated = load_json(AUTOMATED_FILE)

        if not isinstance(raw, list):
            raise ValueError("businesses.json must contain a JSON array.")

        if not isinstance(manual, dict):
            raise ValueError("Manual business data must be a JSON object.")

        if not isinstance(automated, dict):
            raise ValueError("Automated business data must be a JSON object.")

        manual_business = manual.get("business", {})
        automated_business = automated.get("business", {})

        if not isinstance(manual_business, dict):
            raise ValueError("Manual business section is invalid.")

        if not isinstance(automated_business, dict):
            raise ValueError("Automated business section is invalid.")

        manual_records = manual_business.get("directory", [])
        old_records = automated_business.get("directory", [])

        if not isinstance(manual_records, list):
            raise ValueError("Manual directory must be a list.")

        if not isinstance(old_records, list):
            raise ValueError("Automated directory must be a list.")

        reserved = {
            record.get("id")
            for record in manual_records + old_records
            if isinstance(record, dict) and record.get("id")
        }

        # Preserve non-Apify records from previous automated imports.
        preserved = [
            record for record in old_records
            if isinstance(record, dict)
            and record.get("source") != SOURCE
        ]

        imported = []
        skipped = 0

        for item in raw:
            if not isinstance(item, dict):
                skipped += 1
                continue

            record = extract_record(item, reserved)

            if record is None:
                skipped += 1
                continue

            imported.append(record)

        final_records = preserved + imported

        sections = {
            "shop": 0,
            "eat": 0,
            "entertain": 0,
            "miscellaneous": 0
        }

        for record in imported:
            sections[record["section"]] += 1

        print("\n========== APIFY IMPORT REPORT ==========")
        print(f"Input records:          {len(raw)}")
        print(f"Valid records:          {len(imported)}")
        print(f"Skipped records:        {skipped}")
        print(f"Manual records:         {len(manual_records)}")
        print(f"Preserved other records:{len(preserved)}")
        print(f"Final automated count:  {len(final_records)}")
        print("\nSection distribution:")

        for section, count in sections.items():
            print(f"  {section.title():20} {count}")

        print("\nAll new records: unverified")
        print(f"Output: {AUTOMATED_FILE}")

        if args.dry_run:
            print("\nDRY RUN: No files were changed.")
            return 0

        # Preserve other automated business fields.
        updated = dict(automated)
        updated_business = dict(automated_business)

        updated_business["directory"] = final_records
        updated["business"] = updated_business

        metadata = dict(updated.get("metadata", {}))
        metadata["last_apify_import"] = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat()
        metadata["apify_records_imported"] = len(imported)
        updated["metadata"] = metadata

        save_json(AUTOMATED_FILE, updated)

        print("\nIMPORT COMPLETED SUCCESSFULLY.")
        return 0

    except (OSError, ValueError, TypeError, KeyError) as error:
        print(f"\nIMPORT FAILED: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
