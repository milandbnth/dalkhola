#!/usr/bin/env python3
"""Build Dalkhola Online's automated Services dataset from raw Apify exports.

The raw JSON files are READ ONLY. Every accepted Google Places record is copied
without renaming, dropping, or rewriting its original fields. Only the outer
category buckets and generated metadata are new.

Expected inputs:
  data/raw/apify/services/latest.json       (banking search export)
  data/raw/apify/services/hotels.json
  data/raw/apify/services/diagnostics.json
  data/raw/apify/services/pharmacies.json

Output:
  data/modules/services/automated/content.json
  reports/services-data-audit.json

Run from the repository root:
  python scripts/services/process_services_data.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data/raw/apify/services"
OUTPUT = ROOT / "data/modules/services/automated/content.json"
AUDIT = ROOT / "reports/services-data-audit.json"
CURATED_BANKING = ROOT / "data/modules/services/automated/curated_banking.json"

# Dalkhola town centre; 12 km intentionally includes nearby Goalgaon,
# Nichitpur, Choncha, Baluganj, Sarsar and neighbouring settlements.
CENTRE = (25.8800, 87.8400)
RADIUS_KM = 12.0
# A bad geocoder can attach a distant place-name to coordinates near town.
# Exclude this explicit distant locality even if its coordinates look local.
EXCLUDED_LOCALITY_TERMS = ("alipurduar",)

INPUTS = {
    "banking": "latest.json",
    "hotels": "hotels.json",
    "diagnostics": "diagnostics.json",
    "pharmacies": "pharmacies.json",
}

BANK_CATEGORIES = {
    "bank", "atm", "public sector bank", "private sector bank",
    "financial institution", "loan agency", "money transfer service",
    "financial consultant",
}
HOTEL_CATEGORIES = {"hotel", "lodge", "guest house", "guesthouse"}
DIAGNOSTIC_CATEGORIES = {
    "diagnostic center", "medical diagnostic imaging center",
    "pathologist", "blood testing service", "laboratory", "medical laboratory",
    "medical clinic", "clinic", "dental clinic", "hospital",
    "public medical center", "medical center", "skin care clinic",
    "free clinic", "sports medicine clinic", "orthodontist",
}
PHARMACY_CATEGORIES = {
    "pharmacy", "drug store", "drugstore", "homeopathic pharmacy",
    "medical supply store",
}


def norm(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def category_values(record: dict[str, Any]) -> set[str]:
    values = set()
    if record.get("categoryName"):
        values.add(norm(record["categoryName"]))
    for value in record.get("categories") or []:
        if value:
            values.add(norm(value))
    return values


def haversine_km(lat: float, lon: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(CENTRE[0]), math.radians(lat)
    dp = math.radians(lat - CENTRE[0])
    dl = math.radians(lon - CENTRE[1])
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def locality_text(record: dict[str, Any]) -> str:
    return " ".join(norm(record.get(k)) for k in ("title", "address", "city", "neighborhood"))


def is_in_area(record: dict[str, Any]) -> tuple[bool, str]:
    text = locality_text(record)
    if any(term in text for term in EXCLUDED_LOCALITY_TERMS):
        return False, "excluded_distant_locality"
    location = record.get("location") or {}
    try:
        lat, lon = float(location["lat"]), float(location["lng"])
    except (KeyError, TypeError, ValueError):
        # Do not silently discard an otherwise clearly local listing solely
        # because coordinates are absent; retain only when locality text helps.
        local_terms = ("dalkhola", "goalgaon", "nichitpur", "choncha", "baluganj", "sarsar", "bhagabanpur", "dehuty", "mithapur", "hatbari")
        if any(term in text for term in local_terms):
            return True, "locality_text_no_coordinates"
        return False, "missing_coordinates_and_locality"
    distance = haversine_km(lat, lon)
    if distance > RADIUS_KM:
        return False, f"outside_{RADIUS_KM:g}km_radius"
    return True, f"within_{distance:.2f}km"


def is_open_record(record: dict[str, Any]) -> bool:
    # Temporarily closed records are retained, with the original status field,
    # so the frontend can label them accurately. Permanently closed are omitted.
    return record.get("permanentlyClosed") is not True


def pharmacy_match(record: dict[str, Any], cats: set[str]) -> bool:
    if cats & PHARMACY_CATEGORIES:
        return True
    # Google sometimes classifies medical halls/stores as Medical Center.
    if "medical center" in cats:
        name = norm(record.get("title"))
        return any(term in name for term in ("medical hall", "medical store", "medical agency", "medical shop", "chemist", "pharma"))
    return False


def matches(bucket: str, record: dict[str, Any]) -> bool:
    cats = category_values(record)
    if bucket == "banking":
        return bool(cats & BANK_CATEGORIES)
    if bucket == "hotels":
        return bool(cats & HOTEL_CATEGORIES)
    if bucket == "diagnostics":
        # A dual-listed pharmacy belongs in Pharmacies, not Diagnostics.
        if cats & PHARMACY_CATEGORIES:
            return False
        if "medical center" in cats and pharmacy_match(record, cats):
            return False
        # Standalone doctor profiles are not assumed to be clinics.
        if cats == {"doctor"}:
            return False
        return bool(cats & DIAGNOSTIC_CATEGORIES)
    if bucket == "pharmacies":
        return pharmacy_match(record, cats)
    return False


def load_array(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"Required raw dataset not found: {path}")
    with path.open("r", encoding="utf-8-sig") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"Expected a top-level JSON array in {path}")
    if any(not isinstance(row, dict) for row in data):
        raise ValueError(f"Every item in {path} must be a JSON object")
    return data


def dedupe_key(record: dict[str, Any]) -> str:
    if record.get("placeId"):
        return "place:" + str(record["placeId"])
    return "fallback:" + norm(record.get("title")) + "|" + norm(record.get("address"))


def process() -> tuple[dict[str, Any], dict[str, Any]]:
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    buckets: dict[str, list[dict[str, Any]]] = {name: [] for name in INPUTS}
    source_stats: dict[str, Any] = {}
    seen_global: dict[str, str] = {}
    rejected: list[dict[str, str]] = []

    for bucket, filename in INPUTS.items():
        rows = load_array(RAW_DIR / filename)
        stats = Counter()
        category_counts = Counter()
        for row in rows:
            category_counts[row.get("categoryName") or "(unknown)"] += 1
            if not matches(bucket, row):
                stats["wrong_category"] += 1
                continue
            in_area, area_reason = is_in_area(row)
            if not in_area:
                stats[area_reason] += 1
                rejected.append({"source": filename, "title": str(row.get("title") or ""), "reason": area_reason})
                continue
            if not is_open_record(row):
                stats["permanently_closed"] += 1
                rejected.append({"source": filename, "title": str(row.get("title") or ""), "reason": "permanently_closed"})
                continue
            key = dedupe_key(row)
            if key in seen_global:
                stats["duplicate"] += 1
                continue
            seen_global[key] = bucket
            # Keep every source field/value untouched.
            buckets[bucket].append(row)
            stats["included"] += 1
            if row.get("temporarilyClosed") is True:
                stats["temporarily_closed_retained"] += 1
        source_stats[bucket] = {
            "file": filename,
            "input_records": len(rows),
            "input_category_counts": dict(category_counts),
            "processing": dict(stats),
            "included_records": len(buckets[bucket]),
        }

    curated_banking = []
    if CURATED_BANKING.is_file():
        with CURATED_BANKING.open("r", encoding="utf-8-sig") as f:
            curated_banking = json.load(f)
        if not isinstance(curated_banking, list):
            raise ValueError(f"Expected a top-level JSON array in {CURATED_BANKING}")

    output = {
        "metadata": {
            "category": "Services & Utilities - Automated Listings",
            "generated_at": generated_at,
            "source": "Apify Google Places exports",
            "source_files": INPUTS,
            "record_policy": "Original Google Places record objects are preserved without field renaming or mutation.",
            "geographic_filter": {
                "centre": {"lat": CENTRE[0], "lng": CENTRE[1]},
                "radius_km": RADIUS_KM,
                "excluded_locality_terms": list(EXCLUDED_LOCALITY_TERMS),
                "coverage_note": "Includes nearby Dalkhola-area settlements when within radius; does not enforce municipal boundaries.",
            },
            "source_stats": source_stats,
            "curated_banking_records": len(curated_banking),
            "total_records": sum(len(v) for v in buckets.values()) + len(curated_banking),
        },
        **buckets,
        "curated_banking": curated_banking,
    }
    audit = {
        "generated_at": generated_at,
        "sources": source_stats,
        "included_by_category": {**{k: len(v) for k, v in buckets.items()}, "curated_banking": len(curated_banking)},
        "total_included": sum(len(v) for v in buckets.values()) + len(curated_banking),
        "rejected_records": rejected,
        "raw_files_modified": False,
    }
    return output, audit


def main() -> int:
    try:
        output, audit = process()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DALKHOLA ONLINE — SERVICES DATA PROCESSOR")
    print("Raw source files were not modified.")
    for name, count in audit["included_by_category"].items():
        print(f"{name:14} {count:>3} records")
    print(f"TOTAL          {audit['total_included']:>3} records")
    print(f"Published input: {OUTPUT.relative_to(ROOT)}")
    print(f"Audit report:    {AUDIT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
