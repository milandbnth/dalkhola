
"""
Dalkhola Online - Apify Services Collector

Collects Google Maps listings for the Services module.

Actor:
    compass/crawler-google-places

Output:
    data/raw/apify/services/latest.json

The existing Business collector and its data are not modified.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from apify_client import ApifyClient


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

ACTOR_ID = "compass/crawler-google-places"

LOCATION = "Dalkhola, West Bengal, India"

MAX_RESULTS_PER_SEARCH = 50

OUTPUT_DIR = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "raw"
    / "apify"
    / "services"
)

OUTPUT_FILE = OUTPUT_DIR / "latest.json"


# ---------------------------------------------------------
# SERVICES SEARCH CATEGORIES
# ---------------------------------------------------------

SERVICE_CATEGORIES = {
    "banking": [
        "bank",
        "bank branch",
        "ATM",
    ],

    "hotels_and_lodging": [
        "hotel",
        "lodge",
        "guest house",
    ],

    "restaurants": [
        "restaurant",
        "dhaba",
        "cafe",
    ],

    "diagnostic_centres_and_clinics": [
        "diagnostic centre",
        "pathology lab",
        "diagnostic clinic",
        "clinic",
    ],

    "pharmacies": [
        "pharmacy",
        "medical store",
        "chemist",
    ],
}


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def get_apify_token():
    """Read the Apify API token from the environment."""

    token = os.environ.get("APIFY_TOKEN")

    if not token:
        print("\nERROR: APIFY_TOKEN environment variable is missing.")
        print("Set your Apify token before running this script.")
        sys.exit(1)

    return token


def extract_dataset_items(client, dataset_id):
    """Read all records from an Apify dataset."""

    if not dataset_id:
        return []

    items = client.dataset(dataset_id).iterate_items()

    return list(items)


def run_category_search(client, category, search_terms):
    """Run the Apify Actor for one Services category."""

    print("\n" + "=" * 60)
    print(f"COLLECTING: {category.upper()}")
    print("=" * 60)

    run_input = {
        "searchStringsArray": search_terms,
        "locationQuery": LOCATION,
        "maxCrawledPlacesPerSearch": MAX_RESULTS_PER_SEARCH,
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

    print("Search terms:", ", ".join(search_terms))
    print("Location:", LOCATION)
    print("Starting Apify Actor...")

    run = client.actor(ACTOR_ID).call(
    run_input=run_input
)

    if not run:
     raise RuntimeError(
        f"Apify Actor did not return a run for {category}"
    )

# Convert Apify Run object into a dictionary
    run_data = run.data

    if not run_data:
     raise RuntimeError(
        f"Apify returned no run data for {category}"
    )

    dataset_id = run_data.get("defaultDatasetId")

    if not dataset_id:
        raise RuntimeError(
            f"No dataset ID returned for {category}"
        )

    records = extract_dataset_items(client, dataset_id)

    print(f"Records collected: {len(records)}")

    tagged_records = []

    for record in records:
        tagged_records.append({
            "service_category": category,
            "search_terms": search_terms,
            "raw": record,
        })

    return {
        "category": category,
        "search_terms": search_terms,
        "dataset_id": dataset_id,
        "record_count": len(records),
        "records": tagged_records,
    }


# ---------------------------------------------------------
# MAIN COLLECTOR
# ---------------------------------------------------------

def main():

    print("\n")
    print("#" * 60)
    print("DALKHOLA ONLINE - SERVICES DATA COLLECTOR")
    print("#" * 60)

    token = get_apify_token()

    client = ApifyClient(token)

    collected_at = datetime.now(
        timezone.utc
    ).isoformat()

    all_records = []
    category_results = {}

    # Run each category independently.
    for category, search_terms in SERVICE_CATEGORIES.items():

        try:
            result = run_category_search(
                client,
                category,
                search_terms,
            )

            category_results[category] = {
                "dataset_id": result["dataset_id"],
                "record_count": result["record_count"],
                "status": "success",
            }

            all_records.extend(result["records"])

        except Exception as error:

            print(
                f"\nERROR collecting {category}: {error}"
            )

            category_results[category] = {
                "record_count": 0,
                "status": "failed",
                "error": str(error),
            }

            # Do not publish an incomplete collection.
            print(
                "\nCollection stopped. Existing latest.json "
                "will not be overwritten."
            )
            sys.exit(1)

    # -----------------------------------------------------
    # BUILD OUTPUT
    # -----------------------------------------------------

    output = {
        "metadata": {
            "project": "Dalkhola Online",
            "module": "services",
            "source": "Apify Google Maps Actor",
            "actor_id": ACTOR_ID,
            "location": LOCATION,
            "collected_at": collected_at,
            "total_records": len(all_records),
            "categories": category_results,
        },

        "records": all_records,
    }

    # -----------------------------------------------------
    # SAVE OUTPUT SAFELY
    # -----------------------------------------------------

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = OUTPUT_FILE.with_suffix(".tmp")

    with temporary_file.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    # Replace latest.json only after the complete collection.
    temporary_file.replace(OUTPUT_FILE)

    # -----------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------

    print("\n")
    print("#" * 60)
    print("SERVICES COLLECTION COMPLETED")
    print("#" * 60)

    print(f"Total records: {len(all_records)}")

    for category, details in category_results.items():

        print(
            f"{category}: "
            f"{details['record_count']} records "
            f"({details['status']})"
        )

    print("\nOutput saved to:")
    print(OUTPUT_FILE)

    print("\nNext step:")
    print("Run scripts/adapt_apify_services.py")


# ---------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------

if __name__ == "__main__":
    main()
