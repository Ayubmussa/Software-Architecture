import os
from typing import Any

import requests

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
INDEX_NAME = os.getenv("ELASTICSEARCH_INDEX", "products")


def _url(path: str) -> str:
    return f"{ELASTICSEARCH_URL}/{path.lstrip('/')}"


def ping() -> bool:
    try:
        response = requests.get(_url(""), timeout=1.5)
        return response.ok
    except requests.RequestException:
        return False


def ensure_index() -> bool:
    if not ping():
        return False
    mapping = {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "text"},
                "description": {"type": "text"},
                "category": {"type": "keyword"},
                "price": {"type": "float"},
                "stock": {"type": "integer"},
            }
        }
    }
    try:
        response = requests.put(_url(INDEX_NAME), json=mapping, timeout=2)
        # 200 index created, 400 already exists (acceptable)
        return response.status_code in (200, 400)
    except requests.RequestException:
        return False


def index_product(product: Any) -> None:
    if not ensure_index():
        return
    payload = {
        "id": int(product.id),
        "name": product.name,
        "description": product.description or "",
        "category": product.category or "",
        "price": float(product.price),
        "stock": int(product.stock),
    }
    try:
        requests.put(_url(f"{INDEX_NAME}/_doc/{product.id}"), json=payload, timeout=2)
    except requests.RequestException:
        pass


def delete_product(product_id: int) -> None:
    if not ping():
        return
    try:
        requests.delete(_url(f"{INDEX_NAME}/_doc/{product_id}"), timeout=2)
    except requests.RequestException:
        pass


def search_product_ids(query: str, size: int = 100) -> list[int] | None:
    if not ensure_index():
        return None
    body = {
        "size": max(1, min(size, 200)),
        "query": {
            "multi_match": {
                "query": query,
                "fields": ["name^3", "description", "category^2"],
                "fuzziness": "AUTO",
            }
        },
    }
    try:
        response = requests.get(_url(f"{INDEX_NAME}/_search"), json=body, timeout=2.5)
        if not response.ok:
            return None
        data = response.json()
        hits = data.get("hits", {}).get("hits", [])
        ids: list[int] = []
        for hit in hits:
            source = hit.get("_source", {})
            value = source.get("id")
            if isinstance(value, int):
                ids.append(value)
        return ids
    except requests.RequestException:
        return None

