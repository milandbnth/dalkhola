#!/usr/bin/env python3
"""Safely move curated banking records out of the manual Services module.

This is deliberately a separate, opt-in operation. It creates a timestamped
backup before changing the manual file. The original banking record objects
are copied unchanged into automated/curated_banking.json so their existing
DLK-SRV IDs, IFSC data and curated details are retained.

Run from repository root:
  python scripts/services/migrate_manual_services.py --dry-run
  python scripts/services/migrate_manual_services.py --apply
Then rerun process_services_data.py to include curated_banking in the output.
"""
import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANUAL = ROOT / "data/modules/services/manual/content.json"
CURATED = ROOT / "data/modules/services/automated/curated_banking.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes after creating a backup")
    args = parser.parse_args()

    if not MANUAL.is_file():
        raise SystemExit(f"Manual Services file not found: {MANUAL}")
    data = json.loads(MANUAL.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise SystemExit("Manual Services file must contain a JSON object")

    banking = data.get("banking", [])
    if not isinstance(banking, list):
        raise SystemExit("Expected 'banking' to be an array")
    existing = []
    if CURATED.exists():
        existing = json.loads(CURATED.read_text(encoding="utf-8-sig"))
        if not isinstance(existing, list):
            raise SystemExit("Existing curated_banking.json must be a JSON array")

    # Keep pre-existing curated records first; append only new stable IDs.
    seen = {str(x.get("id")) for x in existing if isinstance(x, dict) and x.get("id")}
    migrated = list(existing)
    for record in banking:
        record_id = str(record.get("id") or "")
        if not record_id or record_id not in seen:
            migrated.append(record)
            if record_id:
                seen.add(record_id)

    cleaned = dict(data)
    cleaned.pop("banking", None)
    cleaned.pop("city_summary", None)  # summary duplicates the primary records

    print(f"Manual banking records to migrate: {len(banking)}")
    print(f"Curated banking records after migration: {len(migrated)}")
    print("Manual categories retained:", ", ".join(k for k in cleaned if k != "metadata"))
    print("Police Station record: not present; do not invent contact/address details.")
    if not args.apply:
        print("DRY RUN only. No files changed. Use --apply to create backup and apply.")
        return 0

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = MANUAL.with_name(f"content.json.backup-{stamp}")
    shutil.copy2(MANUAL, backup)
    CURATED.parent.mkdir(parents=True, exist_ok=True)
    CURATED.write_text(json.dumps(migrated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANUAL.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Backup created: {backup.relative_to(ROOT)}")
    print(f"Curated banking saved: {CURATED.relative_to(ROOT)}")
    print(f"Manual Services updated: {MANUAL.relative_to(ROOT)}")
    print("Now rerun: python scripts/services/process_services_data.py")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
