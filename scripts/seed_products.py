#!/usr/bin/env python3
"""
Seed the product-service database with a diverse catalog of products and reviews.

Usage (from repo root):
  python scripts/seed_products.py
  python scripts/seed_products.py --base-url http://localhost:5001
  python scripts/seed_products.py --reset   # delete all products first, then seed

Requires the product-service to be running (default http://localhost:5001).
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

DEFAULT_BASE_URL = "http://localhost:5001"

# ---------------------------------------------------------------------------
# Product catalog — 50 items across 10 categories
# ---------------------------------------------------------------------------

PRODUCTS: list[dict[str, Any]] = [
    # ── Electronics (8) ──────────────────────────────────────────────────────
    {
        "name": "ProBook 15 Laptop",
        "description": "15.6\" FHD display, Intel i7, 16GB RAM, 512GB SSD. Ideal for work and light gaming.",
        "category": "Electronics",
        "price": 999.99,
        "stock": 24,
        "image_url": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Alex M.", "rating": 5, "comment": "Fast and reliable for daily work.", "verified_purchase": True},
            {"author_name": "Sarah K.", "rating": 4, "comment": "Great value, battery could be better.", "verified_purchase": True},
        ],
    },
    {
        "name": "UltraPhone X Pro",
        "description": "6.7\" OLED, 256GB storage, triple camera system, 5G ready.",
        "category": "Electronics",
        "price": 899.00,
        "stock": 45,
        "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Mike T.", "rating": 5, "comment": "Camera quality is outstanding.", "verified_purchase": True},
        ],
    },
    {
        "name": "NoiseCancel Pro Headphones",
        "description": "Active noise cancellation, 30-hour battery, premium over-ear comfort.",
        "category": "Electronics",
        "price": 249.99,
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Emma L.", "rating": 5, "comment": "Best ANC I've tried at this price.", "verified_purchase": True},
            {"author_name": "James R.", "rating": 4, "comment": "Comfortable for long flights.", "verified_purchase": False},
        ],
    },
    {
        "name": "SmartWatch Series 5",
        "description": "Heart rate, GPS, sleep tracking, water resistant to 50m.",
        "category": "Electronics",
        "price": 329.00,
        "stock": 38,
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Chris P.", "rating": 4, "comment": "Solid fitness tracker.", "verified_purchase": True},
        ],
    },
    {
        "name": "4K Ultra HD Smart TV 55\"",
        "description": "55-inch 4K UHD, HDR10, built-in streaming apps, voice remote.",
        "category": "Electronics",
        "price": 649.99,
        "stock": 15,
        "image_url": "https://images.unsplash.com/photo-1593359673509-e9591a1a0a0a?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "David W.", "rating": 5, "comment": "Picture quality is stunning.", "verified_purchase": True},
        ],
    },
    {
        "name": "Wireless Earbuds Pro",
        "description": "True wireless, IPX5 sweat resistant, 24h total battery with case.",
        "category": "Electronics",
        "price": 129.99,
        "stock": 80,
        "image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Lisa H.", "rating": 4, "comment": "Great for workouts.", "verified_purchase": True},
        ],
    },
    {
        "name": "Portable Bluetooth Speaker",
        "description": "360° sound, 12-hour playtime, waterproof IPX7, party mode pairing.",
        "category": "Electronics",
        "price": 79.99,
        "stock": 55,
        "image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Tom B.", "rating": 5, "comment": "Loud and clear for outdoor use.", "verified_purchase": True},
        ],
    },
    {
        "name": "Mechanical Gaming Keyboard",
        "description": "RGB backlit, Cherry MX switches, programmable macros, USB passthrough.",
        "category": "Electronics",
        "price": 149.99,
        "stock": 42,
        "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Ryan G.", "rating": 5, "comment": "Typing feel is perfect.", "verified_purchase": True},
        ],
    },
    # ── Home & Kitchen (6) ───────────────────────────────────────────────────
    {
        "name": "Espresso Machine Deluxe",
        "description": "15-bar pump, milk frother, programmable shots, stainless steel body.",
        "category": "Home & Kitchen",
        "price": 299.99,
        "stock": 20,
        "image_url": "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Maria S.", "rating": 5, "comment": "Barista-quality coffee at home.", "verified_purchase": True},
        ],
    },
    {
        "name": "Air Fryer Max 6L",
        "description": "6-liter capacity, 8 presets, digital touch screen, dishwasher-safe basket.",
        "category": "Home & Kitchen",
        "price": 89.99,
        "stock": 35,
        "image_url": "https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Jenny C.", "rating": 4, "comment": "Crispy fries without oil.", "verified_purchase": True},
        ],
    },
    {
        "name": "Robot Vacuum Cleaner",
        "description": "Smart mapping, app control, 120-min runtime, auto-empty base optional.",
        "category": "Home & Kitchen",
        "price": 399.00,
        "stock": 18,
        "image_url": "https://images.unsplash.com/photo-1558317374-0aa037a4a5a8?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Paul D.", "rating": 4, "comment": "Saves so much time.", "verified_purchase": True},
        ],
    },
    {
        "name": "Stand Mixer Pro 5Qt",
        "description": "5-quart bowl, 10 speeds, includes dough hook, whisk, and paddle.",
        "category": "Home & Kitchen",
        "price": 279.99,
        "stock": 22,
        "image_url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Anna B.", "rating": 5, "comment": "Perfect for baking bread.", "verified_purchase": True},
        ],
    },
    {
        "name": "Ceramic Cookware Set 10-Piece",
        "description": "Non-stick ceramic coating, oven safe to 450°F, induction compatible.",
        "category": "Home & Kitchen",
        "price": 159.99,
        "stock": 30,
        "image_url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d4046?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Kate F.", "rating": 4, "comment": "Even heating, easy cleanup.", "verified_purchase": True},
        ],
    },
    {
        "name": "Smart LED Light Bulbs 4-Pack",
        "description": "WiFi enabled, 16M colors, voice control, energy efficient.",
        "category": "Home & Kitchen",
        "price": 49.99,
        "stock": 100,
        "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Steve L.", "rating": 5, "comment": "Easy setup with Alexa.", "verified_purchase": True},
        ],
    },
    # ── Fashion (6) ──────────────────────────────────────────────────────────
    {
        "name": "Classic Leather Jacket",
        "description": "Genuine leather, quilted lining, multiple pockets, timeless style.",
        "category": "Fashion",
        "price": 189.99,
        "stock": 28,
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Marcus J.", "rating": 5, "comment": "Quality leather, fits great.", "verified_purchase": True},
        ],
    },
    {
        "name": "Running Sneakers Ultra",
        "description": "Lightweight mesh, cushioned sole, breathable, sizes 6–13.",
        "category": "Fashion",
        "price": 119.99,
        "stock": 50,
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Nina O.", "rating": 5, "comment": "Most comfortable runners ever.", "verified_purchase": True},
            {"author_name": "Carlos M.", "rating": 4, "comment": "Good grip on trails.", "verified_purchase": True},
        ],
    },
    {
        "name": "Designer Sunglasses",
        "description": "UV400 protection, polarized lenses, lightweight acetate frame.",
        "category": "Fashion",
        "price": 79.99,
        "stock": 65,
        "image_url": "https://images.unsplash.com/photo-1572635196233-8f9f797c59e0?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Sophie A.", "rating": 4, "comment": "Stylish and protective.", "verified_purchase": True},
        ],
    },
    {
        "name": "Wool Blend Winter Coat",
        "description": "Warm wool blend, detachable hood, water-resistant outer shell.",
        "category": "Fashion",
        "price": 149.99,
        "stock": 32,
        "image_url": "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Rachel N.", "rating": 5, "comment": "Keeps me warm in cold winters.", "verified_purchase": True},
        ],
    },
    {
        "name": "Leather Crossbody Bag",
        "description": "Full-grain leather, adjustable strap, multiple compartments.",
        "category": "Fashion",
        "price": 89.99,
        "stock": 40,
        "image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d12836?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Olivia T.", "rating": 5, "comment": "Perfect everyday bag.", "verified_purchase": True},
        ],
    },
    {
        "name": "Stainless Steel Watch",
        "description": "Automatic movement, sapphire crystal, 100m water resistance.",
        "category": "Fashion",
        "price": 249.99,
        "stock": 25,
        "image_url": "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Daniel K.", "rating": 5, "comment": "Elegant and precise.", "verified_purchase": True},
        ],
    },
    # ── Sports & Outdoors (6) ────────────────────────────────────────────────
    {
        "name": "Yoga Mat Premium 6mm",
        "description": "Non-slip TPE, eco-friendly, includes carrying strap.",
        "category": "Sports & Outdoors",
        "price": 39.99,
        "stock": 70,
        "image_url": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Yoga Fan", "rating": 5, "comment": "Great grip even when sweaty.", "verified_purchase": True},
        ],
    },
    {
        "name": "Adjustable Dumbbell Set 20kg",
        "description": "Quick-change weight plates, compact design, home gym essential.",
        "category": "Sports & Outdoors",
        "price": 149.99,
        "stock": 25,
        "image_url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Gym Bro", "rating": 4, "comment": "Space-saving and versatile.", "verified_purchase": True},
        ],
    },
    {
        "name": "Mountain Bike Trail 27.5\"",
        "description": "Aluminum frame, 21-speed, front suspension, disc brakes.",
        "category": "Sports & Outdoors",
        "price": 449.99,
        "stock": 12,
        "image_url": "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Trail Rider", "rating": 5, "comment": "Handles rough terrain well.", "verified_purchase": True},
        ],
    },
    {
        "name": "Camping Tent 4-Person",
        "description": "Waterproof, easy setup, mesh windows, rainfly included.",
        "category": "Sports & Outdoors",
        "price": 129.99,
        "stock": 20,
        "image_url": "https://images.unsplash.com/photo-1478131143081-5f1f41a6c2f6?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Camper Joe", "rating": 4, "comment": "Spacious and dry in rain.", "verified_purchase": True},
        ],
    },
    {
        "name": "Insulated Water Bottle 32oz",
        "description": "Keeps cold 24h / hot 12h, BPA-free, leak-proof lid.",
        "category": "Sports & Outdoors",
        "price": 34.99,
        "stock": 90,
        "image_url": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Hiker Sam", "rating": 5, "comment": "Ice stays frozen all day.", "verified_purchase": True},
        ],
    },
    {
        "name": "Fitness Tracker Band",
        "description": "Step count, heart rate, sleep, 7-day battery, swim-proof.",
        "category": "Sports & Outdoors",
        "price": 59.99,
        "stock": 55,
        "image_url": "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Fit Life", "rating": 4, "comment": "Motivates me to move more.", "verified_purchase": True},
        ],
    },
    # ── Books (5) ────────────────────────────────────────────────────────────
    {
        "name": "The Art of Software Design",
        "description": "Comprehensive guide to modern software architecture patterns and practices.",
        "category": "Books",
        "price": 49.99,
        "stock": 45,
        "image_url": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Dev Reader", "rating": 5, "comment": "Must-read for architects.", "verified_purchase": True},
        ],
    },
    {
        "name": "Clean Code Handbook",
        "description": "Best practices for writing maintainable, readable code.",
        "category": "Books",
        "price": 39.99,
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Code Ninja", "rating": 5, "comment": "Changed how I write code.", "verified_purchase": True},
        ],
    },
    {
        "name": "Microservices Patterns",
        "description": "Design patterns for distributed systems and microservices.",
        "category": "Books",
        "price": 54.99,
        "stock": 35,
        "image_url": "https://images.unsplash.com/photo-1589998055854-a9632492a0a0?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Backend Dev", "rating": 4, "comment": "Practical examples throughout.", "verified_purchase": True},
        ],
    },
    {
        "name": "Design Thinking Workbook",
        "description": "Exercises and frameworks for human-centered product design.",
        "category": "Books",
        "price": 29.99,
        "stock": 50,
        "image_url": "https://images.unsplash.com/photo-1456513087680-66aa8a9446e5?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "UX Designer", "rating": 5, "comment": "Great for workshops.", "verified_purchase": True},
        ],
    },
    {
        "name": "Data Structures & Algorithms",
        "description": "In-depth coverage with Python and Java implementations.",
        "category": "Books",
        "price": 44.99,
        "stock": 40,
        "image_url": "https://images.unsplash.com/photo-1532012197268-da8521bd1e5e?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "CS Student", "rating": 5, "comment": "Clear explanations.", "verified_purchase": True},
        ],
    },
    # ── Beauty & Personal Care (5) ─────────────────────────────────────────
    {
        "name": "Hydrating Face Serum",
        "description": "Hyaluronic acid + vitamin C, 30ml, suitable for all skin types.",
        "category": "Beauty & Personal Care",
        "price": 34.99,
        "stock": 75,
        "image_url": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Beauty Fan", "rating": 5, "comment": "Skin feels plump and hydrated.", "verified_purchase": True},
        ],
    },
    {
        "name": "Electric Toothbrush Pro",
        "description": "Sonic technology, 5 modes, 2-min timer, 2 brush heads included.",
        "category": "Beauty & Personal Care",
        "price": 79.99,
        "stock": 45,
        "image_url": "https://images.unsplash.com/photo-1607613002730-b8ed3751272a?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Smile Bright", "rating": 4, "comment": "Dentist noticed the difference.", "verified_purchase": True},
        ],
    },
    {
        "name": "Organic Shampoo & Conditioner Set",
        "description": "Sulfate-free, argan oil, for dry and damaged hair, 400ml each.",
        "category": "Beauty & Personal Care",
        "price": 24.99,
        "stock": 80,
        "image_url": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Hair Care", "rating": 4, "comment": "Hair feels softer.", "verified_purchase": True},
        ],
    },
    {
        "name": "Men's Grooming Kit",
        "description": "Beard oil, balm, comb, scissors — complete beard care set.",
        "category": "Beauty & Personal Care",
        "price": 44.99,
        "stock": 35,
        "image_url": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Beard Guy", "rating": 5, "comment": "Everything I need in one kit.", "verified_purchase": True},
        ],
    },
    {
        "name": "Sunscreen SPF 50",
        "description": "Broad spectrum, lightweight, non-greasy, 100ml.",
        "category": "Beauty & Personal Care",
        "price": 18.99,
        "stock": 100,
        "image_url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Sun Safe", "rating": 5, "comment": "No white cast, absorbs fast.", "verified_purchase": True},
        ],
    },
    # ── Toys & Games (5) ─────────────────────────────────────────────────────
    {
        "name": "Building Blocks Set 500pc",
        "description": "Compatible bricks, assorted colors, includes storage box.",
        "category": "Toys & Games",
        "price": 39.99,
        "stock": 55,
        "image_url": "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Parent of 2", "rating": 5, "comment": "Kids love it, hours of fun.", "verified_purchase": True},
        ],
    },
    {
        "name": "Strategy Board Game",
        "description": "2–4 players, 60–90 min, award-winning strategy game.",
        "category": "Toys & Games",
        "price": 49.99,
        "stock": 30,
        "image_url": "https://images.unsplash.com/photo-1611892440508-42a784e144fb?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Game Night", "rating": 5, "comment": "Our new favorite game.", "verified_purchase": True},
        ],
    },
    {
        "name": "Remote Control Drone",
        "description": "HD camera, 15-min flight, altitude hold, one-key return.",
        "category": "Toys & Games",
        "price": 89.99,
        "stock": 25,
        "image_url": "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Drone Pilot", "rating": 4, "comment": "Fun for beginners.", "verified_purchase": True},
        ],
    },
    {
        "name": "Plush Teddy Bear 40cm",
        "description": "Soft hypoallergenic fabric, machine washable, gift-ready.",
        "category": "Toys & Games",
        "price": 24.99,
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1530329281457-6febb2840d66?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Gift Giver", "rating": 5, "comment": "Adorable and soft.", "verified_purchase": True},
        ],
    },
    {
        "name": "Puzzle 1000 Pieces",
        "description": "Landscape scene, premium cardboard, 68×48cm finished size.",
        "category": "Toys & Games",
        "price": 19.99,
        "stock": 45,
        "image_url": "https://images.unsplash.com/photo-1606092195730-7d7b9af1efc5?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Puzzle Lover", "rating": 4, "comment": "Challenging and relaxing.", "verified_purchase": True},
        ],
    },
    # ── Office & Stationery (4) ──────────────────────────────────────────────
    {
        "name": "Ergonomic Office Chair",
        "description": "Lumbar support, adjustable height, breathable mesh back.",
        "category": "Office & Stationery",
        "price": 249.99,
        "stock": 18,
        "image_url": "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "WFH Pro", "rating": 5, "comment": "Back pain gone.", "verified_purchase": True},
        ],
    },
    {
        "name": "Standing Desk Converter",
        "description": "Sit-stand adjustable, holds dual monitors, keyboard tray.",
        "category": "Office & Stationery",
        "price": 179.99,
        "stock": 22,
        "image_url": "https://images.unsplash.com/photo-1593640408182-31c70c8268d5?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Desk Worker", "rating": 4, "comment": "Easy to switch positions.", "verified_purchase": True},
        ],
    },
    {
        "name": "Premium Notebook Set 3-Pack",
        "description": "A5 dotted pages, 120gsm paper, hardcover, lay-flat binding.",
        "category": "Office & Stationery",
        "price": 29.99,
        "stock": 70,
        "image_url": "https://images.unsplash.com/photo-1531346878377-a5be20888a57?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Journaler", "rating": 5, "comment": "Paper quality is excellent.", "verified_purchase": True},
        ],
    },
    {
        "name": "Wireless Mouse Silent",
        "description": "Ergonomic design, 2.4GHz + Bluetooth, 18-month battery.",
        "category": "Office & Stationery",
        "price": 34.99,
        "stock": 85,
        "image_url": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Office User", "rating": 4, "comment": "Quiet clicks, comfortable.", "verified_purchase": True},
        ],
    },
    # ── Health & Wellness (5) ────────────────────────────────────────────────
    {
        "name": "Multivitamin Daily 90 Tablets",
        "description": "Complete daily vitamins and minerals, one-a-day formula.",
        "category": "Health & Wellness",
        "price": 22.99,
        "stock": 120,
        "image_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Health Conscious", "rating": 4, "comment": "Easy to take daily.", "verified_purchase": True},
        ],
    },
    {
        "name": "Essential Oil Diffuser",
        "description": "Ultrasonic, 7 LED colors, auto shut-off, 300ml tank.",
        "category": "Health & Wellness",
        "price": 39.99,
        "stock": 50,
        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Zen Home", "rating": 5, "comment": "Creates a calming atmosphere.", "verified_purchase": True},
        ],
    },
    {
        "name": "Foam Roller High Density",
        "description": "18\" length, trigger point release, includes exercise guide.",
        "category": "Health & Wellness",
        "price": 29.99,
        "stock": 40,
        "image_url": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Recovery Pro", "rating": 5, "comment": "Great for post-workout.", "verified_purchase": True},
        ],
    },
    {
        "name": "Protein Powder Vanilla 2lb",
        "description": "25g protein per serving, low sugar, mixable with water or milk.",
        "category": "Health & Wellness",
        "price": 44.99,
        "stock": 55,
        "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Gym Rat", "rating": 4, "comment": "Tastes good, mixes well.", "verified_purchase": True},
        ],
    },
    {
        "name": "Sleep Mask & Ear Plugs Set",
        "description": "Silk sleep mask, contoured design, 32dB ear plugs included.",
        "category": "Health & Wellness",
        "price": 19.99,
        "stock": 90,
        "image_url": "https://images.unsplash.com/photo-1541783245831-57d405fb43b7?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Light Sleeper", "rating": 5, "comment": "Finally sleeping through the night.", "verified_purchase": True},
        ],
    },
    # ── Garden & Outdoor (5) ─────────────────────────────────────────────────
    {
        "name": "Garden Tool Set 5-Piece",
        "description": "Trowel, cultivator, weeder, pruner, gloves — rust-resistant steel.",
        "category": "Garden & Outdoor",
        "price": 49.99,
        "stock": 35,
        "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Green Thumb", "rating": 5, "comment": "Sturdy and well-made.", "verified_purchase": True},
        ],
    },
    {
        "name": "Outdoor String Lights 50ft",
        "description": "Weatherproof LED, warm white, connectable, timer included.",
        "category": "Garden & Outdoor",
        "price": 34.99,
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Patio Host", "rating": 5, "comment": "Perfect ambiance for evenings.", "verified_purchase": True},
        ],
    },
    {
        "name": "Raised Garden Bed Kit",
        "description": "4×4 ft cedar wood, easy assembly, drainage holes.",
        "category": "Garden & Outdoor",
        "price": 89.99,
        "stock": 20,
        "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Urban Gardener", "rating": 4, "comment": "Great for small spaces.", "verified_purchase": True},
        ],
    },
    {
        "name": "Bird Feeder Solar Powered",
        "description": "Squirrel-proof, 2lb capacity, solar light for evening viewing.",
        "category": "Garden & Outdoor",
        "price": 44.99,
        "stock": 30,
        "image_url": "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Bird Watcher", "rating": 5, "comment": "Birds love it.", "verified_purchase": True},
        ],
    },
    {
        "name": "Patio Umbrella 9ft",
        "description": "UV-resistant fabric, crank lift, tilt mechanism, base not included.",
        "category": "Garden & Outdoor",
        "price": 79.99,
        "stock": 25,
        "image_url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=600&fit=crop",
        "reviews": [
            {"author_name": "Backyard BBQ", "rating": 4, "comment": "Good shade coverage.", "verified_purchase": True},
        ],
    },
]


def _check_service(base_url: str) -> bool:
    try:
        r = requests.get(f"{base_url.rstrip('/')}/health", timeout=5)
        return r.ok
    except requests.RequestException:
        return False


def _fetch_existing_names(base_url: str) -> set[str]:
    names: set[str] = set()
    skip = 0
    limit = 100
    while True:
        try:
            r = requests.get(
                f"{base_url.rstrip('/')}/api/products",
                params={"skip": skip, "limit": limit},
                timeout=10,
            )
            r.raise_for_status()
            batch = r.json()
        except requests.RequestException as e:
            print(f"Warning: could not fetch products: {e}")
            break
        if not batch:
            break
        for p in batch:
            names.add(p.get("name", ""))
        if len(batch) < limit:
            break
        skip += limit
    return names


def _delete_all_products(base_url: str) -> int:
    deleted = 0
    skip = 0
    limit = 100
    while True:
        try:
            r = requests.get(
                f"{base_url.rstrip('/')}/api/products",
                params={"skip": skip, "limit": limit},
                timeout=10,
            )
            r.raise_for_status()
            batch = r.json()
        except requests.RequestException:
            break
        if not batch:
            break
        for p in batch:
            pid = p.get("id")
            if pid:
                try:
                    requests.delete(
                        f"{base_url.rstrip('/')}/api/products/{pid}",
                        timeout=5,
                    )
                    deleted += 1
                except requests.RequestException:
                    pass
        if len(batch) < limit:
            break
        skip += limit
    return deleted


def _create_product(base_url: str, payload: dict[str, Any]) -> dict | None:
    body = {
        "name": payload["name"],
        "description": payload.get("description"),
        "category": payload.get("category"),
        "price": payload["price"],
        "stock": payload["stock"],
        "image_url": payload.get("image_url"),
    }
    try:
        r = requests.post(
            f"{base_url.rstrip('/')}/api/products",
            json=body,
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        print(f"  ERROR creating '{payload['name']}': {e}")
        if hasattr(e, "response") and e.response is not None:
            try:
                print(f"  Response: {e.response.text[:200]}")
            except Exception:
                pass
        return None


def _create_review(
    base_url: str, product_id: int, review: dict[str, Any]
) -> bool:
    body = {
        "author_name": review["author_name"],
        "rating": review["rating"],
        "comment": review.get("comment"),
        "verified_purchase": review.get("verified_purchase", False),
    }
    try:
        r = requests.post(
            f"{base_url.rstrip('/')}/api/products/{product_id}/reviews",
            json=body,
            timeout=5,
        )
        r.raise_for_status()
        return True
    except requests.RequestException:
        return False


def _reindex(base_url: str) -> bool:
    try:
        r = requests.post(
            f"{base_url.rstrip('/')}/api/products/search/reindex",
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        print(f"  Reindexed {data.get('reindexed', '?')} products into Elasticsearch.")
        return True
    except requests.RequestException as e:
        print(f"  Reindex skipped (Elasticsearch may be down): {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed product-service with sample catalog")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Product service base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all existing products before seeding",
    )
    parser.add_argument(
        "--no-reindex",
        action="store_true",
        help="Skip Elasticsearch reindex after seeding",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    print(f"Product service: {base_url}")
    if not _check_service(base_url):
        print("ERROR: Product service is not reachable. Start it first:")
        print("  cd services/product-service && python -m uvicorn app.main:app --reload --port 5001")
        return 1

    if args.reset:
        print("Resetting: deleting existing products...")
        n = _delete_all_products(base_url)
        print(f"  Deleted {n} product(s).")
        existing_names: set[str] = set()
    else:
        existing_names = _fetch_existing_names(base_url)
        print(f"Found {len(existing_names)} existing product(s).")

    created = 0
    skipped = 0
    reviews_added = 0

    for item in PRODUCTS:
        name = item["name"]
        if name in existing_names:
            print(f"  Skip (exists): {name}")
            skipped += 1
            continue

        product = _create_product(base_url, item)
        if not product:
            continue

        pid = product.get("id")
        created += 1
        print(f"  Created #{pid}: {name} ({item.get('category', '?')}) — ${item['price']}")

        for rev in item.get("reviews", []):
            if _create_review(base_url, pid, rev):
                reviews_added += 1

        time.sleep(0.05)  # gentle pacing

    print()
    print(f"Done: {created} products created, {skipped} skipped, {reviews_added} reviews added.")

    if created > 0 and not args.no_reindex:
        print("Reindexing search...")
        _reindex(base_url)

    return 0


if __name__ == "__main__":
    sys.exit(main())
