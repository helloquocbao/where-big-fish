import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCATIONS_DETAILS_DIR = os.path.join(BASE_DIR, 'src/data/locations/details')
LOCATIONS_INDEX_DIR = os.path.join(BASE_DIR, 'src/data/locations')
SPECIES_DETAILS_DIR = os.path.join(BASE_DIR, 'src/data/species/details')
SPECIES_INDEX_DIR = os.path.join(BASE_DIR, 'src/data/species')

def generate_indexes():
    # Locations Index
    location_summaries = []
    water_types = {"freshwater": [], "brackish": [], "saltwater": []}
    
    for filename in os.listdir(LOCATIONS_DETAILS_DIR):
        if filename.endswith('.json'):
            with open(os.path.join(LOCATIONS_DETAILS_DIR, filename), 'r') as f:
                data = json.load(f)
                summary = {
                    "slug": data["id"],
                    "title": data["content"]["title"],
                    "speciesName": data["species"]["commonName"],
                    "country": data["location"]["country"],
                    "continent": data["location"]["continent"],
                    "waterType": data["location"]["waterType"],
                    "maxWeightKg": data["species"]["maxWeightKg"],
                    "isAllowed": data["fishing"]["isAllowed"],
                    "heroImage": data["media"]["heroImage"],
                    "heroImageAlt": data["media"]["heroImageAlt"],
                    "difficulty": data["content"]["difficulty"],
                    "featured": data["featured"],
                    "tags": data["tags"]
                }
                location_summaries.append(summary)
                water_types[data["location"]["waterType"]].append(summary)
    
    # Sort by maxWeightKg descending
    location_summaries.sort(key=lambda x: x["maxWeightKg"], reverse=True)
    
    with open(os.path.join(LOCATIONS_INDEX_DIR, 'index.json'), 'w') as f:
        json.dump(location_summaries, f, indent=2)
        
    for wtype, items in water_types.items():
        items.sort(key=lambda x: x["maxWeightKg"], reverse=True)
        with open(os.path.join(LOCATIONS_INDEX_DIR, f'{wtype}.json'), 'w') as f:
            json.dump(items, f, indent=2)
            
    # Species Index
    species_summaries = []
    for filename in os.listdir(SPECIES_DETAILS_DIR):
        if filename.endswith('.json'):
            with open(os.path.join(SPECIES_DETAILS_DIR, filename), 'r') as f:
                data = json.load(f)
                summary = {
                    "slug": data["slug"],
                    "commonName": data["commonName"],
                    "scientificName": data["scientificName"],
                    "waterType": data["waterType"],
                    "maxWeightKg": data["maxWeightKg"],
                    "image": data["image"]
                }
                species_summaries.append(summary)
    
    species_summaries.sort(key=lambda x: x["maxWeightKg"], reverse=True)
    with open(os.path.join(SPECIES_INDEX_DIR, 'index.json'), 'w') as f:
        json.dump(species_summaries, f, indent=2)

    print("Index files generated successfully.")

if __name__ == "__main__":
    generate_indexes()
