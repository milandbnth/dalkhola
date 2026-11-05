
import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

# Project paths
INPUT_FILE = Path("businesses_raw.json")
OUTPUT_FILE = Path("businesses.json")

# Approximate Dalkhola town centre
CENTER_LAT = 25.8508
CENTER_LNG = 87.8477
RADIUS_KM = 5


def distance_km(lat, lng):
    earth_radius = 6371

    lat1 = radians(CENTER_LAT)
    lat2 = radians(lat)
    dlat = radians(lat - CENTER_LAT)
    dlng = radians(lng - CENTER_LNG)

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    )

    return earth_radius * 2 * atan2(
        sqrt(a), sqrt(1 - a)
    )


def get_photo(item):
    for field in ("imageUrls", "photoGalleryUrls"):
        urls = item.get(field)
        if isinstance(urls, list):
            for url in urls:
                if isinstance(url, str) and url.startswith("http"):
                    return url

    for field in ("images", "photoGallery"):
        photos = item.get(field)
        if isinstance(photos, list):
            for photo in photos:
                if isinstance(photo, dict):
                    url = photo.get("url")
                    if isinstance(url, str) and url.startswith("http"):
                        return url

    for field in ("imageUrl", "photoUrl"):
        url = item.get(field)
        if isinstance(url, str) and url.startswith("http"):
            return url

    return None


def get_coordinates(item):
    location = item.get("location") or {}

    if not isinstance(location, dict):
        location = {}

    lat = location.get("lat", item.get("latitude"))
    lng = location.get("lng", item.get("longitude"))

    if lat is None or lng is None:
        return None, None

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None, None

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, None

    return lat, lng


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Cannot find {INPUT_FILE}. Put your downloaded Apify JSON "
            "in the project root and name it businesses_raw.json."
        )

    with INPUT_FILE.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    # Support both a plain array and common Apify export wrappers.
    if isinstance(raw, dict):
        raw = raw.get("items", raw.get("data", raw.get("results")))

    if not isinstance(raw, list):
        raise ValueError("Expected an Apify JSON array of business records.")

    results = []
    seen = set()

    outside = 0
    missing = 0
    closed = 0
    duplicates = 0

    for item in raw:
        if not isinstance(item, dict):
            continue

        if item.get("permanentlyClosed") or item.get("temporarilyClosed"):
            closed += 1
            continue

        name = (item.get("title") or item.get("name") or "").strip()

        if not name:
            continue

        lat, lng = get_coordinates(item)

        if lat is None or lng is None:
            missing += 1
            continue

        distance = distance_km(lat, lng)

        if distance > RADIUS_KM:
            outside += 1
            continue

        address = item.get("address")
        place_id = item.get("placeId")

        key = (
            place_id
            or f"{name.lower()}|{(address or '').lower()}"
        )

        if key in seen:
            duplicates += 1
            continue

        seen.add(key)

        results.append({
            "name": name,
            "photo_url": get_photo(item),
            "location": {
                "address": address,
                "latitude": lat,
                "longitude": lng
            }
        })

    if not results:
        raise RuntimeError(
            "No businesses passed the filter. "
            "The original input file was not changed."
        )

    temp_file = OUTPUT_FILE.with_suffix(".tmp")

    with temp_file.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    temp_file.replace(OUTPUT_FILE)

    print("\n========== DALKHOLA FILTER REPORT ==========")
    print(f"Original records:       {len(raw)}")
    print(f"Outside 5 km:           {outside}")
    print(f"Missing coordinates:    {missing}")
    print(f"Closed businesses:      {closed}")
    print(f"Duplicates removed:     {duplicates}")
    print(f"Businesses retained:    {len(results)}")
    print(f"Output file:            {OUTPUT_FILE.resolve()}")
    print("============================================")


if __name__ == "__main__":
    main()
