
import json
import os
from pathlib import Path
from apify_client import ApifyClient

TOKEN = os.environ.get("APIFY_TOKEN")

if not TOKEN:
    raise RuntimeError("APIFY_TOKEN environment variable is missing.")

client = ApifyClient(TOKEN)

SEARCH_TERMS = [
    "shop",
    "grocery store",
    "clothing store",
    "restaurant",
    "hotel",
    "cafe",
    "market",
    "pharmacy",
    "electronics store",
    "bank",
    "petrol pump",
    "entertainment",
]

run_input = {
    "searchStringsArray": SEARCH_TERMS,
    "locationQuery": "Dalkhola, West Bengal, India",
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "scrapeSocialMediaProfiles": {
        "facebooks": False,
        "instagrams": False,
        "youtubes": False,
        "tiktoks": False,
        "twitters": False,
    },
    "maximumLeadsEnrichmentRecords": 0,
    "maxCompetitorsToAnalyze": 0,
}

print("Starting Apify Google Maps scraper...")

run = client.actor(
    "compass/crawler-google-places"
).call(run_input=run_input)

dataset_id = run.get("defaultDatasetId")

if not dataset_id:
    raise RuntimeError("Apify did not return a dataset ID.")

print(f"Dataset: https://console.apify.com/storage/datasets/{dataset_id}")

businesses = []
seen = set()

for item in client.dataset(dataset_id).iterate_items():
    name = item.get("title")

    if not name:
        continue

    location = item.get("location") or {}
    address = item.get("address")

    place_id = item.get("placeId")
    key = place_id or f"{name.lower()}|{(address or '').lower()}"

    if key in seen:
        continue

    seen.add(key)

    if item.get("permanentlyClosed") or item.get("temporarilyClosed"):
        continue

    photo_url = None

    for field in ("imageUrls", "photoGalleryUrls"):
        urls = item.get(field)
        if isinstance(urls, list) and urls:
            photo_url = urls[0]
            break

    if not photo_url:
        photo_url = item.get("imageUrl") or item.get("photoUrl")

    businesses.append({
        "name": name.strip(),
        "photo_url": photo_url,
        "location": {
            "address": address,
            "latitude": location.get("lat"),
            "longitude": location.get("lng"),
        },
    })

output = Path("businesses.json")
temporary = output.with_suffix(".tmp")

with temporary.open("w", encoding="utf-8") as file:
    json.dump(businesses, file, ensure_ascii=False, indent=2)

temporary.replace(output)

print(f"Completed! Collected {len(businesses)} businesses.")
print(f"Saved to: {output.resolve()}")
