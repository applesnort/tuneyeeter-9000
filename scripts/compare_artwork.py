#!/usr/bin/env python3
"""
Compare album artwork using perceptual hashing to identify similar images.
This helps match albums across Spotify and Apple Music even if artwork slightly differs.
"""

import sys
import json
import requests
from PIL import Image
from io import BytesIO
import imagehash
import numpy as np
from typing import Optional, Dict, Tuple

def download_image(url: str) -> Optional[Image.Image]:
    """Download image from URL and return PIL Image object."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except Exception as e:
        print(f"Error downloading image from {url}: {e}", file=sys.stderr)
        return None

def calculate_hashes(image: Image.Image) -> Dict[str, str]:
    """Calculate multiple perceptual hashes for better matching."""
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize to standard size for consistent hashing
    image = image.resize((256, 256), Image.Resampling.LANCZOS)
    
    return {
        'average': str(imagehash.average_hash(image)),
        'phash': str(imagehash.phash(image)),
        'dhash': str(imagehash.dhash(image)),
        'whash': str(imagehash.whash(image))
    }

def compare_images(url1: str, url2: str) -> Dict[str, float]:
    """Compare two images and return similarity scores."""
    img1 = download_image(url1)
    img2 = download_image(url2)
    
    if not img1 or not img2:
        return {'error': 'Failed to download one or both images', 'similarity': 0.0}
    
    hashes1 = calculate_hashes(img1)
    hashes2 = calculate_hashes(img2)
    
    # Calculate hash distances (lower is more similar)
    distances = {}
    for hash_type in hashes1:
        hash1 = imagehash.hex_to_hash(hashes1[hash_type])
        hash2 = imagehash.hex_to_hash(hashes2[hash_type])
        distances[hash_type] = hash1 - hash2
    
    # Calculate overall similarity (0-100 scale)
    # Average hash is usually most reliable for album art
    avg_distance = distances['average']
    phash_distance = distances['phash']
    
    # Convert distance to similarity percentage
    # Distance of 0 = 100% similar, distance of 64 = 0% similar
    avg_similarity = max(0, 100 - (avg_distance * 100 / 64))
    phash_similarity = max(0, 100 - (phash_distance * 100 / 64))
    
    # Weighted average favoring average hash
    overall_similarity = (avg_similarity * 0.6 + phash_similarity * 0.4)
    
    return {
        'similarity': overall_similarity,
        'distances': distances,
        'hashes1': hashes1,
        'hashes2': hashes2,
        'avg_similarity': avg_similarity,
        'phash_similarity': phash_similarity
    }

def main():
    """Read URLs from stdin and output similarity score."""
    try:
        data = json.load(sys.stdin)
        url1 = data.get('url1')
        url2 = data.get('url2')
        
        if not url1 or not url2:
            print(json.dumps({'error': 'Missing url1 or url2'}))
            sys.exit(1)
        
        result = compare_images(url1, url2)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e), 'similarity': 0.0}))
        sys.exit(1)

if __name__ == '__main__':
    main()