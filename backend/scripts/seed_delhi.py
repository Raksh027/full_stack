"""Seed complete Delhi dummy users for local discovery, filters, travel, and tonight.

Development only. Safe to re-run: existing delhi.* emails are left unchanged.
Password for every seed account: SeedPass12!
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.config import AppEnv, get_settings
from app.core.security import hash_password
from app.db.session import create_engine, create_session_factory
from app.models.orm import (
    Interest,
    Like,
    Location,
    Preference,
    Profile,
    ProfileInterest,
    ProfileMedia,
    TonightPost,
    TravelJourney,
    User,
    UserAuth,
    UserStatus,
    VerificationStatus,
)

PASSWORD = "SeedPass12!"

# Delhi NCR spots. POINT is lon, lat.
AREAS = {
    "connaught": (28.6304, 77.2177, "Connaught Place"),
    "hauz_khas": (28.5494, 77.2001, "Hauz Khas"),
    "saket": (28.5245, 77.2066, "Saket"),
    "dwarka": (28.5921, 77.0460, "Dwarka"),
    "rohini": (28.7499, 77.0565, "Rohini"),
    "noida": (28.5678, 77.3230, "Noida"),
    "gurgaon": (28.4950, 77.0890, "Gurugram"),
    "gk": (28.5483, 77.2400, "Greater Kailash"),
    "karol_bagh": (28.6510, 77.1900, "Karol Bagh"),
    "lajpat": (28.5677, 77.2433, "Lajpat Nagar"),
    "vasant": (28.5273, 77.1515, "Vasant Kunj"),
    "khan": (28.6002, 77.2270, "Khan Market"),
    "aerocity": (28.5522, 77.1195, "Aerocity"),
    "nehru": (28.5491, 77.2520, "Nehru Place"),
    "mayur": (28.6090, 77.2930, "Mayur Vihar"),
    "south_ex": (28.5687, 77.2201, "South Extension"),
    "janakpuri": (28.6219, 77.0878, "Janakpuri"),
    "pitampura": (28.7032, 77.1320, "Pitampura"),
    "noida62": (28.6200, 77.3650, "Noida Sector 62"),
    "sec29": (28.4679, 77.0680, "Gurugram Sector 29"),
    "faridabad": (28.4089, 77.3178, "Faridabad"),
    "ghaziabad": (28.6692, 77.4538, "Ghaziabad"),
    "chandni": (28.6506, 77.2303, "Chandni Chowk"),
    "rajouri": (28.6469, 77.1225, "Rajouri Garden"),
}


def portrait(kind: str, index: int) -> str:
    return f"https://randomuser.me/api/portraits/{kind}/{index}.jpg"


def extra_photo(kind: str, index: int) -> str:
    return f"https://randomuser.me/api/portraits/{kind}/{(index + 17) % 99}.jpg"


USERS: list[dict] = [
    {
        "email": "delhi.aarav@boomboom.dev",
        "name": "Aarav Mehta",
        "age": 27,
        "gender": "man",
        "orientation": "straight",
        "goal": "serious_love",
        "area": "connaught",
        "kind": "men",
        "pic": 11,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "Product designer who weekends in Hauz Khas. Looking for something real.",
        "languages": ["hindi", "english"],
        "work": "designer",
        "job": "Product Designer",
        "company": "Zomato",
        "school": "NID Ahmedabad",
        "height": 178,
        "nationality": "India",
        "interests": ["music", "travel", "photography", "coffee"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "athletic",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "social",
            "workout": "regular",
            "personality": "ambivert",
        },
    },
    {
        "email": "delhi.kabir@boomboom.dev",
        "name": "Kabir Singh",
        "age": 31,
        "gender": "man",
        "orientation": "straight",
        "goal": "marriage",
        "area": "gurgaon",
        "kind": "men",
        "pic": 22,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Lawyer by day, weekend trekker. Family-minded and a little old school.",
        "languages": ["hindi", "english"],
        "work": "lawyer",
        "job": "Corporate Counsel",
        "company": "Trilegal",
        "school": "NLU Delhi",
        "height": 183,
        "nationality": "India",
        "interests": ["hiking", "sports", "reading", "travel"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "tall",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "sometimes",
            "personality": "caring",
        },
    },
    {
        "email": "delhi.rohan@boomboom.dev",
        "name": "Rohan Kapoor",
        "age": 24,
        "gender": "man",
        "orientation": "bisexual",
        "goal": "casual",
        "area": "hauz_khas",
        "kind": "men",
        "pic": 33,
        "verified": False,
        "online": True,
        "is_new": True,
        "bio": "Indie gigs, late coffee, no labels. Let's see where the night goes.",
        "languages": ["english", "hindi"],
        "work": "student",
        "job": "Masters student",
        "company": None,
        "school": "JNU",
        "height": 172,
        "nationality": "India",
        "interests": ["music", "movies", "gaming", "dancing"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "slim",
            "heightRange": "average",
            "eyeColor": "hazel",
            "smoking": "occasional",
            "drinking": "regular",
            "workout": "never",
            "personality": "funny",
        },
    },
    {
        "email": "delhi.vihaan@boomboom.dev",
        "name": "Vihaan Rao",
        "age": 29,
        "gender": "man",
        "orientation": "gay",
        "goal": "long_term",
        "area": "saket",
        "kind": "men",
        "pic": 44,
        "verified": True,
        "online": True,
        "is_new": False,
        "bio": "Software engineer who cooks better than he codes. Looking for a partner, not a situationship.",
        "languages": ["english", "hindi", "french"],
        "work": "software_engineer",
        "job": "Senior Engineer",
        "company": "Google",
        "school": "IIT Delhi",
        "height": 176,
        "nationality": "India",
        "interests": ["cooking", "fitness", "tech", "movies"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "muscular",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "social",
            "workout": "daily",
            "personality": "romantic",
        },
    },
    {
        "email": "delhi.arjun@boomboom.dev",
        "name": "Arjun Nair",
        "age": 36,
        "gender": "man",
        "orientation": "straight",
        "goal": "travel_partner",
        "area": "aerocity",
        "kind": "men",
        "pic": 55,
        "verified": False,
        "online": False,
        "is_new": False,
        "bio": "Always on a flight. Need someone who packs light and plans big.",
        "languages": ["english", "hindi", "arabic"],
        "work": "entrepreneur",
        "job": "Founder",
        "company": "Skyline Stay",
        "school": "SRCC",
        "height": 180,
        "nationality": "India",
        "interests": ["travel", "food", "photography", "fashion"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "tall",
            "eyeColor": "brown",
            "smoking": "social",
            "drinking": "social",
            "workout": "sometimes",
            "personality": "extrovert",
        },
    },
    {
        "email": "delhi.dev@boomboom.dev",
        "name": "Dev Sharma",
        "age": 22,
        "gender": "man",
        "orientation": "questioning",
        "goal": "new_friends",
        "area": "noida62",
        "kind": "men",
        "pic": 66,
        "verified": False,
        "online": True,
        "is_new": True,
        "bio": "College last year. Gaming, gym, and figuring life out.",
        "languages": ["hindi", "english"],
        "work": "student",
        "job": "Student",
        "company": None,
        "school": "DTU",
        "height": 170,
        "nationality": "India",
        "interests": ["gaming", "sports", "fitness", "movies"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "athletic",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "enthusiast",
            "personality": "introvert",
        },
    },
    {
        "email": "delhi.ishaan@boomboom.dev",
        "name": "Ishaan Bhat",
        "age": 41,
        "gender": "man",
        "orientation": "straight",
        "goal": "mutual_support",
        "area": "faridabad",
        "kind": "men",
        "pic": 75,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Doctor, dog dad, early mornings. Looking for a calm, kind person.",
        "languages": ["hindi", "english"],
        "work": "doctor",
        "job": "Cardiologist",
        "company": "Max Hospital",
        "school": "AIIMS",
        "height": 175,
        "nationality": "India",
        "interests": ["pets", "reading", "nature", "yoga"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "non_drinker",
            "workout": "regular",
            "personality": "caring",
        },
    },
    {
        "email": "delhi.ananya@boomboom.dev",
        "name": "Ananya Gupta",
        "age": 25,
        "gender": "woman",
        "orientation": "straight",
        "goal": "serious_love",
        "area": "hauz_khas",
        "kind": "women",
        "pic": 12,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "Marketing lead who lives for rooftop sunsets and bookstores.",
        "languages": ["hindi", "english"],
        "work": "marketing",
        "job": "Brand Lead",
        "company": "Nykaa",
        "school": "Lady Shri Ram",
        "height": 165,
        "nationality": "India",
        "interests": ["reading", "fashion", "travel", "coffee"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "slim",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "social",
            "workout": "regular",
            "personality": "romantic",
        },
    },
    {
        "email": "delhi.meera@boomboom.dev",
        "name": "Meera Iyer",
        "age": 29,
        "gender": "woman",
        "orientation": "straight",
        "goal": "marriage",
        "area": "south_ex",
        "kind": "women",
        "pic": 21,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Teacher, classical dancer, and a little traditional. Family is important.",
        "languages": ["hindi", "english"],
        "work": "teacher",
        "job": "History Teacher",
        "company": "DPS RK Puram",
        "school": "St. Stephen's",
        "height": 162,
        "nationality": "India",
        "interests": ["dancing", "reading", "yoga", "art"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "short",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "non_drinker",
            "workout": "sometimes",
            "personality": "caring",
        },
    },
    {
        "email": "delhi.sara@boomboom.dev",
        "name": "Sara Khan",
        "age": 23,
        "gender": "woman",
        "orientation": "bisexual",
        "goal": "short_term",
        "area": "khan",
        "kind": "women",
        "pic": 32,
        "verified": False,
        "online": True,
        "is_new": True,
        "bio": "Influencer energy, real conversations. Let's grab dessert in Khan Market.",
        "languages": ["english", "hindi", "urdu"],
        "work": "influencer",
        "job": "Creator",
        "company": "Independent",
        "school": "JMC",
        "height": 168,
        "nationality": "India",
        "interests": ["fashion", "photography", "party", "travel"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "curvy",
            "heightRange": "average",
            "eyeColor": "hazel",
            "smoking": "social",
            "drinking": "regular",
            "workout": "sometimes",
            "personality": "extrovert",
        },
    },
    {
        "email": "delhi.priya@boomboom.dev",
        "name": "Priya Malhotra",
        "age": 33,
        "gender": "woman",
        "orientation": "lesbian",
        "goal": "long_term",
        "area": "gk",
        "kind": "women",
        "pic": 43,
        "verified": True,
        "online": True,
        "is_new": False,
        "bio": "CA who lifts, bakes, and wants a partner who can keep up on both.",
        "languages": ["english", "hindi"],
        "work": "chartered_accountant",
        "job": "Partner",
        "company": "EY",
        "school": "SRCC",
        "height": 170,
        "nationality": "India",
        "interests": ["fitness", "cooking", "hiking", "movies"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "athletic",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "daily",
            "personality": "ambivert",
        },
    },
    {
        "email": "delhi.nisha@boomboom.dev",
        "name": "Nisha Verma",
        "age": 27,
        "gender": "woman",
        "orientation": "pansexual",
        "goal": "freelance",
        "area": "nehru",
        "kind": "women",
        "pic": 54,
        "verified": False,
        "online": False,
        "is_new": False,
        "bio": "Freelance art director. Studio days, gallery nights, open to connection.",
        "languages": ["english", "hindi"],
        "work": "designer",
        "job": "Art Director",
        "company": "Studio Clay",
        "school": "NIFT Delhi",
        "height": 160,
        "nationality": "India",
        "interests": ["art", "photography", "fashion", "coffee"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "slim",
            "heightRange": "short",
            "eyeColor": "brown",
            "smoking": "occasional",
            "drinking": "social",
            "workout": "never",
            "personality": "introvert",
        },
    },
    {
        "email": "delhi.riya@boomboom.dev",
        "name": "Riya Sen",
        "age": 21,
        "gender": "woman",
        "orientation": "straight",
        "goal": "new_friends",
        "area": "lajpat",
        "kind": "women",
        "pic": 65,
        "verified": False,
        "online": True,
        "is_new": True,
        "bio": "Final year, street food explorer, Bollywood playlist on loop.",
        "languages": ["hindi", "english"],
        "work": "student",
        "job": "Student",
        "company": None,
        "school": "DU",
        "height": 158,
        "nationality": "India",
        "interests": ["movies", "food", "dancing", "music"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "short",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "sometimes",
            "personality": "funny",
        },
    },
    {
        "email": "delhi.aditi@boomboom.dev",
        "name": "Aditi Bose",
        "age": 38,
        "gender": "woman",
        "orientation": "straight",
        "goal": "mutual_support",
        "area": "vasant",
        "kind": "women",
        "pic": 76,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Business owner, two cats, slow Sundays. Looking for warmth more than sparks.",
        "languages": ["english", "hindi", "bengali"],
        "work": "business_owner",
        "job": "Founder",
        "company": "Bose Atelier",
        "school": "IIM Bangalore",
        "height": 167,
        "nationality": "India",
        "interests": ["pets", "reading", "yoga", "travel"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "plus_size",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "social",
            "workout": "sometimes",
            "personality": "caring",
        },
    },
    {
        "email": "delhi.kira@boomboom.dev",
        "name": "Kira Das",
        "age": 26,
        "gender": "transgender",
        "orientation": "queer",
        "goal": "serious_love",
        "area": "hauz_khas",
        "kind": "women",
        "pic": 18,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "Performer and writer. Soft heart, sharp humour. Looking for someone brave.",
        "languages": ["english", "hindi"],
        "work": "influencer",
        "job": "Performer",
        "company": "Independent",
        "school": "NSD",
        "height": 174,
        "nationality": "India",
        "interests": ["art", "dancing", "music", "fashion"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "slim",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "social",
            "drinking": "social",
            "workout": "regular",
            "personality": "extrovert",
        },
    },
    {
        "email": "delhi.zara@boomboom.dev",
        "name": "Zara Ali",
        "age": 30,
        "gender": "transgender",
        "orientation": "straight",
        "goal": "long_term",
        "area": "saket",
        "kind": "women",
        "pic": 28,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Makeup artist who loves quiet dinners more than clubs.",
        "languages": ["hindi", "english", "urdu"],
        "work": "designer",
        "job": "Makeup Artist",
        "company": "Studio Glow",
        "school": "JD Institute",
        "height": 171,
        "nationality": "India",
        "interests": ["fashion", "photography", "movies", "coffee"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "curvy",
            "heightRange": "average",
            "eyeColor": "hazel",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "sometimes",
            "personality": "romantic",
        },
    },
    {
        "email": "delhi.neil@boomboom.dev",
        "name": "Neil Fernandes",
        "age": 28,
        "gender": "transgender",
        "orientation": "bisexual",
        "goal": "casual",
        "area": "gurgaon",
        "kind": "men",
        "pic": 19,
        "verified": False,
        "online": True,
        "is_new": True,
        "bio": "UX lead in Cyber Hub. Good playlists, better conversations.",
        "languages": ["english", "hindi"],
        "work": "software_engineer",
        "job": "UX Lead",
        "company": "Razorpay",
        "school": "MIT Pune",
        "height": 177,
        "nationality": "India",
        "interests": ["tech", "music", "gaming", "travel"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "athletic",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "occasional",
            "drinking": "social",
            "workout": "regular",
            "personality": "ambivert",
        },
    },
    {
        "email": "delhi.tara@boomboom.dev",
        "name": "Tara Gill",
        "age": 34,
        "gender": "transgender",
        "orientation": "lesbian",
        "goal": "marriage",
        "area": "dwarka",
        "kind": "women",
        "pic": 38,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Lawyer who gardens. Want a home, not a highlight reel.",
        "languages": ["english", "hindi", "punjabi"],
        "work": "lawyer",
        "job": "Advocate",
        "company": "Independent practice",
        "school": "Campus Law Centre",
        "height": 169,
        "nationality": "India",
        "interests": ["nature", "reading", "yoga", "pets"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "non_drinker",
            "workout": "sometimes",
            "personality": "caring",
        },
    },
    {
        "email": "delhi.alex@boomboom.dev",
        "name": "Alex Roy",
        "age": 26,
        "gender": "nonbinary",
        "orientation": "queer",
        "goal": "new_friends",
        "area": "hauz_khas",
        "kind": "women",
        "pic": 47,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "They/them. Poet, barista, midnight walker around Deer Park.",
        "languages": ["english", "hindi"],
        "work": "other",
        "job": "Barista & writer",
        "company": "Blue Tokai",
        "school": "Ambedkar University",
        "height": 166,
        "nationality": "India",
        "interests": ["reading", "art", "coffee", "music"],
        "lifestyle": {
            "ethnicity": "mixed",
            "bodyType": "slim",
            "heightRange": "average",
            "eyeColor": "green",
            "smoking": "occasional",
            "drinking": "social",
            "workout": "never",
            "personality": "introvert",
        },
    },
    {
        "email": "delhi.sam@boomboom.dev",
        "name": "Sam Khanna",
        "age": 32,
        "gender": "nonbinary",
        "orientation": "pansexual",
        "goal": "travel_partner",
        "area": "aerocity",
        "kind": "men",
        "pic": 48,
        "verified": False,
        "online": True,
        "is_new": False,
        "bio": "Photographer between cities. Delhi is home base this month.",
        "languages": ["english", "hindi"],
        "work": "designer",
        "job": "Travel Photographer",
        "company": "Independent",
        "school": "Srishti",
        "height": 173,
        "nationality": "India",
        "interests": ["photography", "travel", "nature", "hiking"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "average",
            "eyeColor": "brown",
            "smoking": "social",
            "drinking": "occasional",
            "workout": "sometimes",
            "personality": "ambivert",
        },
    },
    {
        "email": "delhi.jamie@boomboom.dev",
        "name": "Jamie D'Souza",
        "age": 24,
        "gender": "nonbinary",
        "orientation": "asexual",
        "goal": "mutual_support",
        "area": "noida",
        "kind": "women",
        "pic": 58,
        "verified": True,
        "online": False,
        "is_new": True,
        "bio": "Ace and proud. Board games, matcha, and low-pressure hangs.",
        "languages": ["english", "hindi"],
        "work": "software_engineer",
        "job": "Frontend Engineer",
        "company": "Paytm",
        "school": "IIIT Delhi",
        "height": 164,
        "nationality": "India",
        "interests": ["gaming", "tech", "coffee", "movies"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "slim",
            "heightRange": "short",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "non_drinker",
            "workout": "sometimes",
            "personality": "funny",
        },
    },
    {
        "email": "delhi.riven@boomboom.dev",
        "name": "Riven Shah",
        "age": 35,
        "gender": "nonbinary",
        "orientation": "demisexual",
        "goal": "serious_love",
        "area": "sec29",
        "kind": "men",
        "pic": 61,
        "verified": True,
        "online": False,
        "is_new": False,
        "bio": "Slow to open up, loyal once I do. Architect who sketches cafes.",
        "languages": ["english", "hindi", "gujarati"],
        "work": "designer",
        "job": "Architect",
        "company": "Studio Riven",
        "school": "SPA Delhi",
        "height": 179,
        "nationality": "India",
        "interests": ["art", "coffee", "travel", "reading"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "average",
            "heightRange": "tall",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "occasional",
            "workout": "regular",
            "personality": "romantic",
        },
    },
    {
        "email": "delhi.noah@boomboom.dev",
        "name": "Noah Kim",
        "age": 28,
        "gender": "man",
        "orientation": "straight",
        "goal": "travel_partner",
        "area": "aerocity",
        "kind": "men",
        "pic": 8,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "In Delhi from Seoul for a month. Show me the best chaat.",
        "languages": ["english", "hangul"],
        "work": "marketing",
        "job": "Brand Manager",
        "company": "Samsung",
        "school": "Yonsei",
        "height": 181,
        "nationality": "South Korea",
        "interests": ["travel", "food", "photography", "fitness"],
        "lifestyle": {
            "ethnicity": "asian",
            "bodyType": "athletic",
            "heightRange": "tall",
            "eyeColor": "brown",
            "smoking": "non_smoker",
            "drinking": "social",
            "workout": "daily",
            "personality": "extrovert",
        },
    },
    {
        "email": "delhi.lina@boomboom.dev",
        "name": "Lina Moreau",
        "age": 30,
        "gender": "woman",
        "orientation": "straight",
        "goal": "casual",
        "area": "khan",
        "kind": "women",
        "pic": 9,
        "verified": True,
        "online": True,
        "is_new": True,
        "bio": "French, here for work. Museums, wine, and someone who knows Delhi after dark.",
        "languages": ["french", "english"],
        "work": "lawyer",
        "job": "Counsel",
        "company": "Embassy project",
        "school": "Sciences Po",
        "height": 169,
        "nationality": "France",
        "interests": ["art", "food", "travel", "fashion"],
        "lifestyle": {
            "ethnicity": "white",
            "bodyType": "slim",
            "heightRange": "average",
            "eyeColor": "blue",
            "smoking": "occasional",
            "drinking": "regular",
            "workout": "regular",
            "personality": "romantic",
        },
    },
]


EXTRA_INTERESTS = ("party", "dancing", "hiking")


def birth_for(age: int) -> date:
    today = date.today()
    return date(today.year - age, 6, 15)


def height_range(cm: int) -> str:
    if cm < 163:
        return "short"
    if cm > 178:
        return "tall"
    return "average"


async def ensure_interests(session) -> dict[str, object]:
    rows = (await session.execute(select(Interest))).scalars().all()
    by_slug = {row.slug: row for row in rows}
    by_name = {row.name.lower(): row for row in rows}
    for name in EXTRA_INTERESTS:
        slug = name.lower()
        if slug in by_slug:
            continue
        interest = Interest(slug=slug, name=name.title())
        session.add(interest)
        await session.flush()
        by_slug[slug] = interest
        by_name[name] = interest
    return by_slug | {key.replace(" ", "-"): value for key, value in by_name.items()}


def resolve_interest(catalog: dict, label: str):
    slug = label.lower().replace(" ", "-")
    return catalog.get(slug) or catalog.get(label.lower())


async def main() -> None:
    settings = get_settings()
    if settings.app_env != AppEnv.DEVELOPMENT:
        raise SystemExit("seed_delhi.py is development-only")

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    created: list[User] = []

    async with factory() as session:
        catalog = await ensure_interests(session)
        now = datetime.now(UTC)

        for item in USERS:
            existing = await session.execute(
                select(UserAuth).where(UserAuth.email == item["email"])
            )
            if existing.scalar_one_or_none():
                continue

            lat, lon, city = AREAS[item["area"]]
            user = User(
                status=UserStatus.ACTIVE.value,
                onboarding_completed=True,
                onboarding_step="done",
                last_active_at=now - timedelta(minutes=2 if item["online"] else 180),
                created_at=now - timedelta(hours=8 if item["is_new"] else 400),
            )
            session.add(user)
            await session.flush()

            session.add(
                UserAuth(
                    user_id=user.id,
                    email=item["email"],
                    password_hash=hash_password(PASSWORD),
                    provider="email",
                    email_verified_at=now,
                )
            )

            lifestyle = dict(item["lifestyle"])
            lifestyle["heightRange"] = height_range(item["height"])
            profile = Profile(
                user_id=user.id,
                display_name=item["name"],
                bio=item["bio"],
                birth_date=birth_for(item["age"]),
                gender=item["gender"],
                orientation=item["orientation"],
                looking_for=item["goal"],
                show_orientation=True,
                languages=item["languages"],
                work_category=item["work"],
                job_title=item["job"],
                company=item["company"],
                school=item["school"],
                height_cm=item["height"],
                lifestyle=lifestyle,
                nationality=item["nationality"],
                verification_status=(
                    VerificationStatus.VERIFIED.value
                    if item["verified"]
                    else VerificationStatus.UNVERIFIED.value
                ),
            )
            session.add(profile)
            await session.flush()

            session.add(
                Preference(
                    user_id=user.id,
                    min_age=18,
                    max_age=50,
                    max_distance_km=80,
                    gender_filter="Everyone",
                    is_discoverable=True,
                    verified_only=False,
                    online_only=False,
                    filters={
                        "interestedIn": ["man", "woman", "transgender", "nonbinary"],
                        "relationshipGoals": [],
                        "bodyTypes": [],
                        "drinking": [],
                        "workout": [],
                        "personality": [],
                        "heightRanges": [],
                        "interests": [],
                        "languages": [],
                        "workCategories": [],
                        "nationality": None,
                    },
                )
            )
            session.add(
                Location(
                    user_id=user.id,
                    geog=WKTElement(f"POINT({lon} {lat})", srid=4326),
                    city=city,
                    region="Delhi NCR",
                    country="India",
                    location_updated_at=now,
                )
            )

            photos = [
                portrait(item["kind"], item["pic"]),
                extra_photo(item["kind"], item["pic"]),
                portrait(item["kind"], (item["pic"] + 31) % 90 + 1),
            ]
            for index, url in enumerate(photos):
                session.add(
                    ProfileMedia(
                        profile_id=profile.id,
                        url=url,
                        thumbnail_url=url,
                        storage_key=f"delhi/{user.id}/{index}-{uuid4().hex}.jpg",
                        media_type="image",
                        sort_order=index,
                        is_primary=index == 0,
                        moderation_status="APPROVED",
                    )
                )

            for label in item["interests"]:
                interest = resolve_interest(catalog, label)
                if interest is None:
                    interest = Interest(slug=label, name=label.replace("_", " ").title())
                    session.add(interest)
                    await session.flush()
                    catalog[label] = interest
                session.add(ProfileInterest(profile_id=profile.id, interest_id=interest.id))

            created.append(user)

        await session.flush()

        emails = {item["email"]: item for item in USERS}
        auths = (
            await session.execute(
                select(UserAuth).where(UserAuth.email.in_(list(emails)))
            )
        ).scalars().all()
        by_email = {auth.email: auth.user_id for auth in auths}

        def uid(email: str):
            return by_email.get(email)

        journeys = [
            (
                "delhi.noah@boomboom.dev",
                "Seoul",
                "South Korea",
                "Delhi",
                "India",
                "vacation",
                "Arriving this week — want a local food crawl.",
            ),
            (
                "delhi.lina@boomboom.dev",
                "Paris",
                "France",
                "Delhi",
                "India",
                "business",
                "Work trip, free evenings around Khan Market.",
            ),
            (
                "delhi.arjun@boomboom.dev",
                "Singapore",
                "Singapore",
                "Delhi",
                "India",
                "vacation",
                "Landing in Delhi next week. Show me the city?",
            ),
            (
                "delhi.ananya@boomboom.dev",
                "Dubai",
                "United Arab Emirates",
                "Delhi",
                "India",
                "nightlife",
                "Just in from Dubai. Who knows the nightlife?",
            ),
            (
                "delhi.meera@boomboom.dev",
                "London",
                "United Kingdom",
                "Delhi",
                "India",
                "business",
                "Work week in Delhi. Evenings free around Lodhi Garden.",
            ),
            (
                "delhi.sara@boomboom.dev",
                "Barcelona",
                "Spain",
                "Delhi",
                "India",
                "vacation",
                "First time in Delhi — street food and rooftops.",
            ),
            (
                "delhi.priya@boomboom.dev",
                "New York",
                "United States",
                "Delhi",
                "India",
                "companion",
                "Looking for a local to explore Hauz Khas and Old Delhi.",
            ),
            (
                "delhi.nisha@boomboom.dev",
                "Berlin",
                "Germany",
                "Delhi",
                "India",
                "solo",
                "Solo trip from Berlin. Museums by day, cafes by night.",
            ),
            (
                "delhi.riya@boomboom.dev",
                "Tokyo",
                "Japan",
                "Delhi",
                "India",
                "vacation",
                "Arriving from Tokyo. Who wants a photo walk?",
            ),
            (
                "delhi.aditi@boomboom.dev",
                "Melbourne",
                "Australia",
                "Delhi",
                "India",
                "business",
                "Conference in Aerocity, free after 7.",
            ),
            (
                "delhi.kabir@boomboom.dev",
                "Dubai",
                "United Arab Emirates",
                "Delhi",
                "India",
                "vacation",
                "Back from Dubai for two weeks. Weekend trek?",
            ),
            (
                "delhi.rohan@boomboom.dev",
                "Amsterdam",
                "Netherlands",
                "Delhi",
                "India",
                "nightlife",
                "Landing tonight. Someone show me Hauz Khas after dark?",
            ),
            (
                "delhi.vihaan@boomboom.dev",
                "Toronto",
                "Canada",
                "Delhi",
                "India",
                "business",
                "Client meetings in Gurugram. Evenings open.",
            ),
            (
                "delhi.dev@boomboom.dev",
                "Lisbon",
                "Portugal",
                "Delhi",
                "India",
                "solo",
                "Slow travel through Delhi. Coffee and bookshops.",
            ),
            (
                "delhi.ishaan@boomboom.dev",
                "Bangkok",
                "Thailand",
                "Delhi",
                "India",
                "vacation",
                "Just flew in from Bangkok. Food crawl anyone?",
            ),
            (
                "delhi.kira@boomboom.dev",
                "Prague",
                "Czechia",
                "Delhi",
                "India",
                "companion",
                "Need a travel buddy for markets and late walks.",
            ),
            (
                "delhi.zara@boomboom.dev",
                "Istanbul",
                "Turkey",
                "Delhi",
                "India",
                "vacation",
                "Arriving from Istanbul. Show me the best kebabs here.",
            ),
            (
                "delhi.alex@boomboom.dev",
                "Copenhagen",
                "Denmark",
                "Delhi",
                "India",
                "solo",
                "Design trip. Looking for galleries and quiet bars.",
            ),
        ]
        for email, frm_city, frm_country, to_city, to_country, trip, desc in journeys:
            user_id = uid(email)
            if user_id is None:
                continue
            exists = await session.execute(
                select(TravelJourney).where(
                    TravelJourney.user_id == user_id,
                    TravelJourney.to_city == to_city,
                )
            )
            if exists.scalar_one_or_none():
                continue
            session.add(
                TravelJourney(
                    user_id=user_id,
                    from_city=frm_city,
                    from_country=frm_country,
                    to_city=to_city,
                    to_country=to_country,
                    departure=(now + timedelta(days=3)).date().isoformat(),
                    return_date=(now + timedelta(days=12)).date().isoformat(),
                    trip_type=trip,
                    travel_style="solo",
                    companion="any",
                    status="upcoming",
                    description=desc,
                    cover_image=portrait("women", 20) if "lina" in email or "ananya" in email else portrait("men", 10),
                )
            )

        tonight = [
            ("delhi.sara@boomboom.dev", "partyBuddy", "Kitty Su", "Rooftop tonight?", "22:00"),
            ("delhi.rohan@boomboom.dev", "drinks", "Blue Tokai Hauz Khas", "Late coffee and music", "21:30"),
            ("delhi.aarav@boomboom.dev", "dinner", "Indian Accent", "Last-minute table for two", "20:30"),
            ("delhi.alex@boomboom.dev", "cityTour", "Deer Park", "Night walk, low key", "21:00"),
        ]
        for email, activity, venue, tagline, meet_time in tonight:
            user_id = uid(email)
            if user_id is None:
                continue
            exists = await session.execute(
                select(TonightPost).where(
                    TonightPost.user_id == user_id,
                    TonightPost.venue == venue,
                )
            )
            if exists.scalar_one_or_none():
                continue
            session.add(
                TonightPost(
                    user_id=user_id,
                    activity=activity,
                    venue=venue,
                    tagline=tagline,
                    looking_for="good company",
                    meet_time=meet_time,
                    featured_photo=portrait("women", 15) if "sara" in email or "alex" in email else portrait("men", 15),
                    expires_at=now + timedelta(hours=10),
                )
            )

        like_pairs = [
            ("delhi.ananya@boomboom.dev", "delhi.aarav@boomboom.dev", False),
            ("delhi.meera@boomboom.dev", "delhi.kabir@boomboom.dev", True),
            ("delhi.sara@boomboom.dev", "delhi.rohan@boomboom.dev", False),
            ("delhi.kira@boomboom.dev", "delhi.alex@boomboom.dev", False),
            ("delhi.priya@boomboom.dev", "delhi.zara@boomboom.dev", False),
            ("delhi.noah@boomboom.dev", "delhi.ananya@boomboom.dev", False),
            ("delhi.lina@boomboom.dev", "delhi.arjun@boomboom.dev", False),
        ]
        for actor_email, target_email, superlike in like_pairs:
            actor_id, target_id = uid(actor_email), uid(target_email)
            if not actor_id or not target_id:
                continue
            exists = await session.execute(
                select(Like).where(Like.actor_id == actor_id, Like.target_id == target_id)
            )
            if exists.scalar_one_or_none():
                continue
            session.add(Like(actor_id=actor_id, target_id=target_id, is_superlike=superlike))

        await session.commit()
        print(f"Seeded {len(created)} new Delhi users. Password: {PASSWORD}")
        print("Emails: delhi.<name>@boomboom.dev")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
