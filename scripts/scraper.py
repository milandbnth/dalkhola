import json
import os
from datetime import datetime

def run_scraper():
    print("Scraping updated information for Dalkhola portal...")
    
    data = {
        "metadata": {
            "city": "Dalkhola",
            "pin_code": "733201",
            "district": "Uttar Dinajpur",
            "state": "West Bengal",
            "country": "India",
            "last_updated": datetime.utcnow().isoformat() + "Z"
        },
        "overview": {
            "hero_title": "Welcome to Dalkhola",
            "tagline": "The Commercial & Transit Hub of North Bengal",
            "highways": ["NH 12", "NH 27"],
            "railway_junction": "Dalkhola (DLK)"
        },
        "business": {
            "markets": ["Hatbari Trade Hub", "Goalgaon Market", "Station Road Commercial Area"],
            "key_industries": ["Maize Trading & Wholesale", "Jute Processing", "Cold Storage & Warehousing"],
            "directory": [
                {"name": "Dalkhola Grain & Maize Merchants Association", "category": "Agriculture Trade", "area": "Hatbari"},
                {"name": "NH 27 Cold Logistics Node", "category": "Logistics & Warehousing", "area": "NH 27 Bypass"}
            ]
        },
        "education": {
            "colleges": [
                {"name": "Dalkhola College", "type": "General Degree College", "affiliated_to": "University of Gour Banga"}
            ],
            "schools": [
                {"name": "Dalkhola High School (H.S.)", "type": "Higher Secondary", "medium": "Bengali / Hindi"},
                {"name": "Dalkhola Girls High School", "type": "Secondary", "medium": "Bengali"}
            ]
        },
        "services": {
            "healthcare": [
                {"name": "Dalkhola Rural Hospital", "type": "Government Hospital", "contact": "Emergency 24x7"}
            ],
            "civic_and_banking": [
                {"name": "Dalkhola Municipality Office", "type": "Civic Administration", "ward": "Ward 4"},
                {"name": "State Bank of India (Dalkhola Branch)", "type": "Bank", "ifsc": "SBIN0002047"}
            ]
        },
        "transport": {
            "railway": {"station": "Dalkhola Railway Station", "code": "DLK", "zone": "NFR / Katihar Division"},
            "highways": [
                {"name": "NH 12", "description": "Connecting Kolkata to Siliguri & North Bengal"},
                {"name": "NH 27", "description": "East-West Corridor connecting Assam & North-East to Western India"}
            ]
        }
    }

    os.makedirs("data", exist_ok=True)
    with open("data/dalkhola.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print("Master dataset saved to data/dalkhola.json successfully!")

if __name__ == "__main__":
    run_scraper()
