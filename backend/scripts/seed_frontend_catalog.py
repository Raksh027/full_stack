"""Seed every frontend catalog person plus travel, tonight, likes, views, and chats.

Development only. Safe to re-run: existing catalog/travel/tonight emails are reused
and missing related rows are added. Password for catalog accounts: SeedPass12!
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
    AppNotification,
    Conversation,
    ConversationMember,
    Interest,
    Like,
    Location,
    Match,
    MatchStatus,
    Message,
    MessageStatus,
    MessageType,
    NotificationType,
    Preference,
    Profile,
    ProfileInterest,
    ProfileMedia,
    ProfileView,
    TonightPost,
    TravelJourney,
    User,
    UserAuth,
    UserStatus,
    VerificationStatus,
)

PASSWORD = "SeedPass12!"
PREFIXES = ("catalog.", "travel.", "tonight.")

DELHI = {
    "connaught": (28.6304, 77.2177, "Connaught Place"),
    "hauz_khas": (28.5494, 77.2001, "Hauz Khas"),
    "saket": (28.5245, 77.2066, "Saket"),
    "gurgaon": (28.4950, 77.0890, "Gurugram"),
    "khan": (28.6002, 77.2270, "Khan Market"),
    "south_ex": (28.5687, 77.2201, "South Extension"),
    "aerocity": (28.5522, 77.1195, "Aerocity"),
    "old_delhi": (28.6506, 77.2303, "Old Delhi"),
    "india_gate": (28.6129, 77.2295, "India Gate"),
    "noida": (28.5678, 77.3230, "Noida"),
    "vasant": (28.5273, 77.1515, "Vasant Kunj"),
    "gk": (28.5483, 77.2400, "Greater Kailash"),
    "dwarka": (28.5921, 77.0460, "Dwarka"),
}

CITIES = {
    "karachi": (24.8607, 67.0011, "Karachi", "Sindh", "Pakistan"),
    "dubai": (25.2048, 55.2708, "Dubai", "Dubai", "United Arab Emirates"),
    "london": (51.5074, -0.1278, "London", "England", "United Kingdom"),
    "newyork": (40.7128, -74.0060, "New York", "NY", "United States"),
    "barcelona": (41.3874, 2.1686, "Barcelona", "Catalonia", "Spain"),
    "paris": (48.8566, 2.3522, "Paris", "Île-de-France", "France"),
    "mumbai": (19.0760, 72.8777, "Mumbai", "Maharashtra", "India"),
}

COVER_BEACH = (
    "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80"
)
COVER_CLIFF = (
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
)
COVER_DUBAI = (
    "https://images.unsplash.com/photo-1512453979798-5ea9330edf76?auto=format&fit=crop&w=900&q=80"
)
COVER_SPA = (
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80"
)
FEATURED_DINNER = (
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
)
FEATURED_DRINKS = (
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80"
)
FEATURED_PARTY = (
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"
)
FEATURED_CITY = (
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80"
)
EXTRA_PHOTOS = [
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80",
]


def lifestyle(
    body: str,
    drink: str,
    workout: str,
    personality: str,
    height: str,
    ethnicity: str = "asian",
) -> dict:
    return {
        "ethnicity": ethnicity,
        "bodyType": body,
        "heightRange": height,
        "eyeColor": "brown",
        "smoking": "non_smoker",
        "drinking": drink,
        "workout": workout,
        "personality": personality,
    }


USERS: list[dict] = [
    {
        "email": "catalog.benz@boomboom.dev",
        "name": "Benz",
        "age": 26,
        "gender": "woman",
        "goal": "marriage",
        "area": "connaught",
        "verified": True,
        "online": True,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80",
        "nationality": "India",
        "height": 168,
        "job": "Fashion stylist",
        "work": "fashion",
        "bio": "Delhi weekends, late coffee, and someone who wants something real.",
        "interests": ["fashion", "music", "travel"],
        "lifestyle": lifestyle("slim", "social", "regular", "romantic", "average"),
    },
    {
        "email": "catalog.amara@boomboom.dev",
        "name": "Amara",
        "age": 24,
        "gender": "woman",
        "goal": "marriage",
        "area": "hauz_khas",
        "verified": True,
        "online": True,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
        "nationality": "India",
        "height": 165,
        "job": "Photographer",
        "work": "creative",
        "bio": "Golden-hour portraits and long walks around Hauz Khas.",
        "interests": ["photography", "art", "coffee"],
        "lifestyle": lifestyle("average", "occasional", "sometimes", "caring", "average"),
    },
    {
        "email": "catalog.rey@boomboom.dev",
        "name": "Rey",
        "age": 26,
        "gender": "man",
        "goal": "casual",
        "area": "saket",
        "verified": False,
        "online": True,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 176,
        "job": "Software engineer",
        "work": "tech",
        "bio": "New in the app. Easy conversations, no heavy scripts.",
        "interests": ["tech", "movies", "food"],
        "lifestyle": lifestyle("athletic", "social", "regular", "ambivert", "average"),
    },
    {
        "email": "catalog.harsh@boomboom.dev",
        "name": "Harsh",
        "age": 26,
        "gender": "man",
        "goal": "long_term",
        "area": "noida",
        "verified": False,
        "online": True,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 180,
        "job": "Product manager",
        "work": "tech",
        "bio": "Noida weekdays, Delhi weekends. Looking for a steady person.",
        "interests": ["music", "travel", "sports"],
        "lifestyle": lifestyle("athletic", "occasional", "regular", "ambivert", "tall"),
    },
    {
        "email": "catalog.bhavya@boomboom.dev",
        "name": "Bhavya",
        "age": 26,
        "gender": "woman",
        "goal": "new_friends",
        "area": "gk",
        "verified": True,
        "online": False,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 162,
        "job": "UX writer",
        "work": "creative",
        "bio": "Bookstores, indie films, and friends who text back.",
        "interests": ["reading", "movies", "coffee"],
        "lifestyle": lifestyle("slim", "never", "sometimes", "caring", "short"),
    },
    {
        "email": "catalog.chirag@boomboom.dev",
        "name": "Chirag",
        "age": 24,
        "gender": "man",
        "goal": "serious_love",
        "area": "connaught",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 175,
        "job": "Consultant",
        "work": "finance",
        "bio": "CP evenings after work. Looking for someone warm and curious.",
        "interests": ["food", "travel", "music"],
        "lifestyle": lifestyle("average", "social", "sometimes", "romantic", "average"),
    },
    {
        "email": "catalog.kapoor@boomboom.dev",
        "name": "Kapoor",
        "age": 26,
        "gender": "man",
        "goal": "casual",
        "area": "gurgaon",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80",
        "nationality": "Pakistan",
        "height": 178,
        "job": "Brand strategist",
        "work": "marketing",
        "bio": "Visiting Delhi often. Easy energy, good playlists.",
        "interests": ["music", "nightlife", "travel"],
        "lifestyle": lifestyle("athletic", "regular", "regular", "adventurous", "average", "south_asian"),
        "languages": ["english", "urdu"],
    },
    {
        "email": "catalog.sajan@boomboom.dev",
        "name": "Sajan",
        "age": 23,
        "gender": "man",
        "goal": "long_term",
        "area": "vasant",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80",
        "nationality": "United Kingdom",
        "height": 182,
        "job": "Exchange student",
        "work": "education",
        "bio": "London roots, Delhi semester. Show me your favourite chaat stall.",
        "interests": ["food", "photography", "travel"],
        "lifestyle": lifestyle("slim", "social", "regular", "ambivert", "tall", "white"),
        "languages": ["english", "hindi"],
    },
    {
        "email": "catalog.noah.ca@boomboom.dev",
        "name": "Noah",
        "age": 27,
        "gender": "man",
        "goal": "new_friends",
        "area": "aerocity",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80",
        "nationality": "Canada",
        "height": 183,
        "job": "Pilot",
        "work": "travel",
        "bio": "Layover nights in Delhi. Looking for locals who know hidden bars.",
        "interests": ["travel", "sports", "food"],
        "lifestyle": lifestyle("athletic", "social", "regular", "adventurous", "tall", "white"),
        "languages": ["english", "french"],
    },
    {
        "email": "catalog.luc@boomboom.dev",
        "name": "Luc",
        "age": 25,
        "gender": "man",
        "goal": "marriage",
        "area": "khan",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=700&q=80",
        "nationality": "France",
        "height": 177,
        "job": "Chef",
        "work": "food",
        "bio": "Cooking for people I like. Wine optional, conversation required.",
        "interests": ["food", "art", "music"],
        "lifestyle": lifestyle("average", "regular", "sometimes", "romantic", "average", "white"),
        "languages": ["french", "english"],
    },
    {
        "email": "catalog.max@boomboom.dev",
        "name": "Max",
        "age": 28,
        "gender": "man",
        "goal": "casual",
        "area": "gurgaon",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=700&q=80",
        "nationality": "Germany",
        "height": 185,
        "job": "Architect",
        "work": "design",
        "bio": "Building cities by day, exploring them after dark.",
        "interests": ["design", "travel", "nightlife"],
        "lifestyle": lifestyle("athletic", "social", "regular", "adventurous", "tall", "white"),
        "languages": ["german", "english"],
    },
    {
        "email": "catalog.kofi@boomboom.dev",
        "name": "Kofi",
        "age": 29,
        "gender": "man",
        "goal": "new_friends",
        "area": "dwarka",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 179,
        "job": "DJ",
        "work": "entertainment",
        "bio": "Vinyl, rooftop sets, and people who stay till last song.",
        "interests": ["music", "nightlife", "dancing"],
        "lifestyle": lifestyle("athletic", "social", "regular", "ambivert", "average"),
    },
    {
        "email": "catalog.noah.in@boomboom.dev",
        "name": "Noah Sharma",
        "age": 27,
        "gender": "man",
        "goal": "casual",
        "area": "noida",
        "verified": False,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 174,
        "job": "Filmmaker",
        "work": "creative",
        "bio": "Quiet edits, loud premieres. Offline more than I should be.",
        "interests": ["movies", "photography", "travel"],
        "lifestyle": lifestyle("slim", "occasional", "never", "ambivert", "average"),
    },
    {
        "email": "catalog.james@boomboom.dev",
        "name": "James",
        "age": 31,
        "gender": "man",
        "goal": "marriage",
        "area": "saket",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 181,
        "job": "Surgeon",
        "work": "healthcare",
        "bio": "Long shifts, longer dinners when I am free.",
        "interests": ["reading", "travel", "food"],
        "lifestyle": lifestyle("average", "occasional", "regular", "caring", "tall"),
    },
    {
        "email": "catalog.priya@boomboom.dev",
        "name": "Priya",
        "age": 25,
        "gender": "woman",
        "goal": "long_term",
        "area": "khan",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 163,
        "job": "Lawyer",
        "work": "law",
        "bio": "Khan Market after court. Looking for someone kind and sharp.",
        "interests": ["reading", "coffee", "travel"],
        "lifestyle": lifestyle("slim", "social", "sometimes", "caring", "average"),
    },
    {
        "email": "catalog.sofia.delhi@boomboom.dev",
        "name": "Sofia",
        "age": 23,
        "gender": "woman",
        "goal": "serious_love",
        "area": "hauz_khas",
        "verified": False,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 160,
        "job": "Student",
        "work": "education",
        "bio": "Campus days, rooftop nights. Text me your favourite song.",
        "interests": ["music", "art", "dancing"],
        "lifestyle": lifestyle("slim", "occasional", "regular", "romantic", "short"),
    },
    {
        "email": "catalog.aisha@boomboom.dev",
        "name": "Aisha",
        "age": 27,
        "gender": "woman",
        "goal": "new_friends",
        "area": "gurgaon",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 167,
        "job": "Marketing lead",
        "work": "marketing",
        "bio": "Cyber Hub happy hours and Sunday markets.",
        "interests": ["food", "travel", "nightlife"],
        "lifestyle": lifestyle("average", "social", "sometimes", "ambivert", "average"),
    },
    {
        "email": "catalog.mia@boomboom.dev",
        "name": "Mia",
        "age": 22,
        "gender": "woman",
        "goal": "casual",
        "area": "south_ex",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 158,
        "job": "Content creator",
        "work": "media",
        "bio": "Spontaneous plans only. If it needs a spreadsheet, I am out.",
        "interests": ["fashion", "dancing", "coffee"],
        "lifestyle": lifestyle("slim", "social", "regular", "adventurous", "short"),
    },
    {
        "email": "catalog.elena@boomboom.dev",
        "name": "Elena",
        "age": 29,
        "gender": "woman",
        "goal": "marriage",
        "area": "vasant",
        "verified": True,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=700&q=80",
        "nationality": "India",
        "height": 170,
        "job": "Diplomat staff",
        "work": "government",
        "bio": "Quiet dinners, serious conversations, no games.",
        "interests": ["art", "reading", "travel"],
        "lifestyle": lifestyle("average", "occasional", "sometimes", "caring", "average", "white"),
        "languages": ["english", "spanish"],
    },
    {
        "email": "catalog.maya@boomboom.dev",
        "name": "Maya",
        "age": 26,
        "gender": "woman",
        "goal": "long_term",
        "area": "gk",
        "verified": True,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80",
        "nationality": "India",
        "height": 166,
        "job": "Yoga teacher",
        "work": "wellness",
        "bio": "Sunrise practice, slow breakfasts, someone who reads.",
        "interests": ["yoga", "travel", "food"],
        "lifestyle": lifestyle("athletic", "never", "regular", "caring", "average"),
    },
    {
        "email": "catalog.lena@boomboom.dev",
        "name": "Lena",
        "age": 23,
        "gender": "woman",
        "goal": "casual",
        "area": "hauz_khas",
        "verified": False,
        "online": True,
        "is_new": True,
        "photo": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=900&q=80",
        "nationality": "India",
        "height": 164,
        "job": "Barista",
        "work": "food",
        "bio": "I remember your usual. Come find me after the rush.",
        "interests": ["coffee", "music", "movies"],
        "lifestyle": lifestyle("slim", "social", "sometimes", "ambivert", "average"),
    },
    {
        "email": "travel.chandan@boomboom.dev",
        "name": "Chandan",
        "age": 25,
        "gender": "man",
        "goal": "long_term",
        "area": "connaught",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 175,
        "job": "Business travel",
        "work": "consulting",
        "bio": "New places, new people, same amazing journey.",
        "interests": ["travel", "business", "food"],
        "lifestyle": lifestyle("athletic", "social", "regular", "ambivert", "average"),
    },
    {
        "email": "travel.kabir@boomboom.dev",
        "name": "Kabir",
        "age": 38,
        "gender": "man",
        "goal": "casual",
        "city_key": "karachi",
        "verified": False,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
        "nationality": "Pakistan",
        "height": 180,
        "job": "Vacation",
        "work": "travel",
        "bio": "Karachi to Phuket. Looking for a beach week buddy.",
        "interests": ["travel", "food", "sports"],
        "lifestyle": lifestyle("average", "social", "sometimes", "adventurous", "tall", "south_asian"),
        "languages": ["urdu", "english"],
    },
    {
        "email": "travel.ananya@boomboom.dev",
        "name": "Ananya",
        "age": 24,
        "gender": "woman",
        "goal": "new_friends",
        "city_key": "london",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1524504388940-b1c17226555e?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 163,
        "job": "Nightlife",
        "work": "entertainment",
        "bio": "London to Bangkok. Temples by day, rooftops by night.",
        "interests": ["travel", "nightlife", "food"],
        "lifestyle": lifestyle("slim", "social", "regular", "adventurous", "average"),
    },
    {
        "email": "travel.maya@boomboom.dev",
        "name": "Maya Al Farsi",
        "age": 25,
        "gender": "woman",
        "goal": "serious_love",
        "city_key": "dubai",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=800&q=80",
        "nationality": "United Arab Emirates",
        "height": 168,
        "job": "Solo travel",
        "work": "travel",
        "bio": "Dubai to Paris. Museums, pastry, and someone who walks slowly.",
        "interests": ["art", "travel", "fashion"],
        "lifestyle": lifestyle("slim", "occasional", "regular", "romantic", "average", "middle_eastern"),
        "languages": ["arabic", "english"],
    },
    {
        "email": "travel.sofia@boomboom.dev",
        "name": "Sofia Ruiz",
        "age": 24,
        "gender": "woman",
        "goal": "casual",
        "area": "india_gate",
        "verified": True,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
        "nationality": "Spain",
        "height": 165,
        "job": "Vacation",
        "work": "travel",
        "bio": "Just landed in Delhi from Barcelona. Who is showing me Old Delhi?",
        "interests": ["travel", "food", "photography"],
        "lifestyle": lifestyle("slim", "social", "regular", "adventurous", "average", "white"),
        "languages": ["spanish", "english"],
    },
    {
        "email": "travel.noah@boomboom.dev",
        "name": "Noah Brooks",
        "age": 29,
        "gender": "man",
        "goal": "long_term",
        "area": "aerocity",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=80",
        "nationality": "United States",
        "height": 183,
        "job": "Business travel",
        "work": "consulting",
        "bio": "New York to Mumbai via Delhi. Evenings free after meetings.",
        "interests": ["business", "travel", "food"],
        "lifestyle": lifestyle("athletic", "social", "regular", "ambivert", "tall", "white"),
        "languages": ["english"],
    },
    {
        "email": "tonight.anaya@boomboom.dev",
        "name": "Anaya",
        "age": 24,
        "gender": "woman",
        "goal": "casual",
        "area": "connaught",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 163,
        "job": "Event planner",
        "work": "entertainment",
        "bio": "Looking to make good memories tonight.",
        "interests": ["food", "music", "travel"],
        "lifestyle": lifestyle("slim", "social", "sometimes", "romantic", "average"),
    },
    {
        "email": "tonight.riya@boomboom.dev",
        "name": "Riya",
        "age": 23,
        "gender": "woman",
        "goal": "new_friends",
        "area": "india_gate",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1524504388940-b1c17226555e?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 165,
        "job": "Tour guide",
        "work": "travel",
        "bio": "Down for a spontaneous city walk.",
        "interests": ["travel", "food", "photography"],
        "lifestyle": lifestyle("average", "occasional", "regular", "adventurous", "average"),
    },
    {
        "email": "tonight.karan@boomboom.dev",
        "name": "Karan",
        "age": 26,
        "gender": "man",
        "goal": "casual",
        "area": "hauz_khas",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 178,
        "job": "Musician",
        "work": "entertainment",
        "bio": "Party mood on. Need a buddy.",
        "interests": ["music", "nightlife", "dancing"],
        "lifestyle": lifestyle("athletic", "regular", "regular", "adventurous", "average"),
    },
    {
        "email": "tonight.sneha@boomboom.dev",
        "name": "Sneha",
        "age": 22,
        "gender": "woman",
        "goal": "casual",
        "area": "khan",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 160,
        "job": "Sommelier intern",
        "work": "food",
        "bio": "Cocktails and conversations tonight.",
        "interests": ["food", "music", "fashion"],
        "lifestyle": lifestyle("slim", "social", "sometimes", "ambivert", "short"),
    },
    {
        "email": "tonight.aisha@boomboom.dev",
        "name": "Aisha Khan",
        "age": 25,
        "gender": "woman",
        "goal": "serious_love",
        "area": "saket",
        "verified": True,
        "online": False,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 168,
        "job": "Teacher",
        "work": "education",
        "bio": "Open to a genuine connection tonight.",
        "interests": ["reading", "food", "travel"],
        "lifestyle": lifestyle("average", "occasional", "sometimes", "caring", "average"),
    },
    {
        "email": "tonight.dev@boomboom.dev",
        "name": "Dev",
        "age": 27,
        "gender": "man",
        "goal": "new_friends",
        "area": "gurgaon",
        "verified": False,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 180,
        "job": "Analyst",
        "work": "finance",
        "bio": "After-work drinks? Count me in.",
        "interests": ["sports", "food", "music"],
        "lifestyle": lifestyle("athletic", "social", "regular", "ambivert", "tall"),
    },
    {
        "email": "tonight.meera@boomboom.dev",
        "name": "Meera",
        "age": 24,
        "gender": "woman",
        "goal": "new_friends",
        "area": "old_delhi",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 163,
        "job": "Historian",
        "work": "education",
        "bio": "Night walk through the city lights.",
        "interests": ["history", "food", "photography"],
        "lifestyle": lifestyle("slim", "never", "sometimes", "caring", "average"),
    },
    {
        "email": "tonight.arjun@boomboom.dev",
        "name": "Arjun",
        "age": 28,
        "gender": "man",
        "goal": "serious_love",
        "area": "south_ex",
        "verified": True,
        "online": True,
        "is_new": False,
        "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
        "nationality": "India",
        "height": 183,
        "job": "Chef",
        "work": "food",
        "bio": "Dinner plans and good company wanted.",
        "interests": ["food", "music", "travel"],
        "lifestyle": lifestyle("average", "social", "sometimes", "romantic", "tall"),
    },
]


JOURNEYS: list[dict] = [
    {
        "email": "travel.chandan@boomboom.dev",
        "from_city": "Delhi",
        "from_country": "India",
        "to_city": "Bangkok",
        "to_country": "Thailand",
        "trip_type": "business",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 3,
        "nights": 8,
        "description": "New places, new people, same amazing journey!",
        "cover": COVER_BEACH,
    },
    {
        "email": "travel.kabir@boomboom.dev",
        "from_city": "Karachi",
        "from_country": "Pakistan",
        "to_city": "Phuket",
        "to_country": "Thailand",
        "trip_type": "vacation",
        "travel_style": "solo",
        "companion": "any",
        "status": "landed",
        "days": -6,
        "nights": 10,
        "description": "Holiday week on the Andaman coast.",
        "cover": COVER_CLIFF,
    },
    {
        "email": "travel.ananya@boomboom.dev",
        "from_city": "London",
        "from_country": "United Kingdom",
        "to_city": "Bangkok",
        "to_country": "Thailand",
        "trip_type": "companion",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 5,
        "nights": 12,
        "description": "Looking for a travel companion for temples and street food.",
        "cover": COVER_BEACH,
    },
    {
        "email": "travel.maya@boomboom.dev",
        "from_city": "Dubai",
        "from_country": "United Arab Emirates",
        "to_city": "Paris",
        "to_country": "France",
        "trip_type": "solo",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 8,
        "nights": 6,
        "description": "Solo museums and pastry crawl.",
        "cover": COVER_CLIFF,
    },
    {
        "email": "travel.sofia@boomboom.dev",
        "from_city": "Barcelona",
        "from_country": "Spain",
        "to_city": "New Delhi",
        "to_country": "India",
        "trip_type": "vacation",
        "travel_style": "couple",
        "companion": "any",
        "status": "upcoming",
        "days": 2,
        "nights": 9,
        "description": "Just arriving in Delhi. Who knows the city?",
        "cover": COVER_BEACH,
    },
    {
        "email": "travel.noah@boomboom.dev",
        "from_city": "New York",
        "from_country": "United States",
        "to_city": "Mumbai",
        "to_country": "India",
        "trip_type": "business",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 4,
        "nights": 5,
        "description": "Work trip with free evenings.",
        "cover": COVER_CLIFF,
    },
    {
        "email": "catalog.priya@boomboom.dev",
        "from_city": "New Delhi",
        "from_country": "India",
        "to_city": "Goa",
        "to_country": "India",
        "trip_type": "vacation",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 10,
        "nights": 4,
        "description": "Beach weekend. Travel buddy for sunset rides?",
        "cover": COVER_CLIFF,
    },
    {
        "email": "catalog.james@boomboom.dev",
        "from_city": "New Delhi",
        "from_country": "India",
        "to_city": "Singapore",
        "to_country": "Singapore",
        "trip_type": "business",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 14,
        "nights": 5,
        "description": "Conference trip. Evenings free around Marina Bay.",
        "cover": COVER_BEACH,
    },
    {
        "email": "catalog.amara@boomboom.dev",
        "from_city": "New Delhi",
        "from_country": "India",
        "to_city": "Bali",
        "to_country": "Indonesia",
        "trip_type": "massageSpa",
        "travel_style": "couple",
        "companion": "any",
        "status": "upcoming",
        "days": 20,
        "nights": 8,
        "description": "Planning massage and spa days, wellness rituals, and quiet beach evenings.",
        "cover": COVER_SPA,
    },
    {
        "email": "catalog.benz@boomboom.dev",
        "from_city": "New Delhi",
        "from_country": "India",
        "to_city": "Paris",
        "to_country": "France",
        "trip_type": "companion",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 16,
        "nights": 6,
        "description": "Looking for a travel companion to explore temples, street food, and nightlife together.",
        "cover": COVER_BEACH,
    },
    {
        "email": "catalog.max@boomboom.dev",
        "from_city": "Mumbai",
        "from_country": "India",
        "to_city": "Dubai",
        "to_country": "United Arab Emirates",
        "trip_type": "tourGuide",
        "travel_style": "solo",
        "companion": "male",
        "status": "upcoming",
        "days": 22,
        "nights": 4,
        "description": "Need a local tour guide for city landmarks, desert views, and evening walks.",
        "cover": COVER_DUBAI,
        "hide": False,
    },
]

TONIGHT: list[dict] = [
    {
        "email": "tonight.anaya@boomboom.dev",
        "activity": "dinner",
        "venue": "Connaught Place, Delhi",
        "tagline": "Looking to make good memories tonight ✨",
        "looking_for": "Good conversations, sharing laughs, and maybe grabbing dinner.",
        "meet_time": "20:30",
        "photo": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=1200&q=80",
        "hours": 3,
    },
    {
        "email": "tonight.riya@boomboom.dev",
        "activity": "cityTour",
        "venue": "India Gate, Delhi",
        "tagline": "Down for a spontaneous city walk ✨",
        "looking_for": "Someone chill to explore cafes, markets, and late-night street food.",
        "meet_time": "21:00",
        "photo": FEATURED_CITY,
        "hours": 1,
    },
    {
        "email": "tonight.karan@boomboom.dev",
        "activity": "partyBuddy",
        "venue": "Hauz Khas, Delhi",
        "tagline": "Party mood on. Need a buddy 🎉",
        "looking_for": "Good vibes, music, and someone who can keep up with the night.",
        "meet_time": "22:00",
        "photo": FEATURED_PARTY,
        "hours": 2,
    },
    {
        "email": "tonight.sneha@boomboom.dev",
        "activity": "drinks",
        "venue": "Khan Market, Delhi",
        "tagline": "Cocktails and conversations tonight 🍸",
        "looking_for": "A relaxed drinks meetup with someone witty and easy to talk to.",
        "meet_time": "21:30",
        "photo": FEATURED_DRINKS,
        "hours": 1,
    },
    {
        "email": "tonight.aisha@boomboom.dev",
        "activity": "dating",
        "venue": "Saket, Delhi",
        "tagline": "Open to a genuine connection tonight ✨",
        "looking_for": "Someone genuine for dinner, laughs, and maybe a little spark.",
        "meet_time": "20:00",
        "photo": FEATURED_DINNER,
        "hours": 2,
    },
    {
        "email": "tonight.dev@boomboom.dev",
        "activity": "drinks",
        "venue": "Cyber Hub, Gurgaon",
        "tagline": "After-work drinks? Count me in.",
        "looking_for": "Casual drinks, good conversation, and zero pressure.",
        "meet_time": "19:30",
        "photo": FEATURED_DRINKS,
        "hours": 5,
    },
    {
        "email": "tonight.meera@boomboom.dev",
        "activity": "cityTour",
        "venue": "Old Delhi",
        "tagline": "Night walk through the city lights ✨",
        "looking_for": "Someone curious to wander food stalls and hidden corners.",
        "meet_time": "20:45",
        "photo": FEATURED_CITY,
        "hours": 1,
    },
    {
        "email": "tonight.arjun@boomboom.dev",
        "activity": "dating",
        "venue": "South Extension, Delhi",
        "tagline": "Dinner plans and good company wanted.",
        "looking_for": "Someone warm and interesting for dinner and a proper conversation.",
        "meet_time": "20:15",
        "photo": FEATURED_DINNER,
        "hours": 4,
    },
    {
        "email": "catalog.lena@boomboom.dev",
        "activity": "dinner",
        "venue": "Hauz Khas Village",
        "tagline": "Last-minute table for two.",
        "looking_for": "Easy company and a shared dessert.",
        "meet_time": "21:00",
        "photo": FEATURED_DINNER,
        "hours": 6,
    },
    {
        "email": "catalog.kofi@boomboom.dev",
        "activity": "partyBuddy",
        "venue": "Kitty Su",
        "tagline": "Playing a set. Come dance.",
        "looking_for": "Someone who stays till the last track.",
        "meet_time": "23:00",
        "photo": FEATURED_PARTY,
        "hours": 7,
    },
]

MY_JOURNEY_TEMPLATES = [
    {
        "from_city": "New Delhi",
        "from_country": "India",
        "to_city": "Bangkok",
        "to_country": "Thailand",
        "trip_type": "companion",
        "travel_style": "solo",
        "companion": "any",
        "status": "upcoming",
        "days": 15,
        "nights": 6,
        "description": "Looking for a travel companion to explore temples, street food, and nightlife together.",
        "cover": COVER_BEACH,
    },
    {
        "from_city": "Mumbai",
        "from_country": "India",
        "to_city": "Dubai",
        "to_country": "United Arab Emirates",
        "trip_type": "tourGuide",
        "travel_style": "solo",
        "companion": "male",
        "status": "upcoming",
        "days": 36,
        "nights": 4,
        "description": "Need a local tour guide for city landmarks, desert views, and evening walks.",
        "cover": COVER_DUBAI,
        "hide": False,
    },
    {
        "from_city": "Bengaluru",
        "from_country": "India",
        "to_city": "Bali",
        "to_country": "Indonesia",
        "trip_type": "massageSpa",
        "travel_style": "couple",
        "companion": "any",
        "status": "active",
        "days": -7,
        "nights": 8,
        "description": "Planning massage and spa days, wellness rituals, and quiet beach evenings.",
        "cover": COVER_SPA,
    },
]

INBOUND_LIKERS = [
    "catalog.amara@boomboom.dev",
    "catalog.priya@boomboom.dev",
    "catalog.mia@boomboom.dev",
    "tonight.anaya@boomboom.dev",
    "travel.sofia@boomboom.dev",
    "catalog.james@boomboom.dev",
    "tonight.dev@boomboom.dev",
    "catalog.lena@boomboom.dev",
]

VIEWERS = [
    "catalog.benz@boomboom.dev",
    "catalog.elena@boomboom.dev",
    "travel.ananya@boomboom.dev",
    "tonight.riya@boomboom.dev",
    "catalog.kofi@boomboom.dev",
    "catalog.maya@boomboom.dev",
]

MATCH_PARTNERS = [
    "catalog.amara@boomboom.dev",
    "tonight.anaya@boomboom.dev",
    "catalog.priya@boomboom.dev",
    "travel.sofia@boomboom.dev",
]


def birth_for(age: int) -> date:
    today = date.today()
    return date(today.year - age, 6, 15)


def height_range(cm: int) -> str:
    if cm < 163:
        return "short"
    if cm > 178:
        return "tall"
    return "average"


def is_seed_email(email: str) -> bool:
    return email.endswith("@boomboom.dev")


async def ensure_interests(session) -> dict[str, object]:
    rows = (await session.execute(select(Interest))).scalars().all()
    catalog = {row.slug: row for row in rows}
    catalog.update({row.name.lower(): row for row in rows})
    return catalog


def resolve_interest(catalog: dict, label: str):
    slug = label.lower().replace(" ", "-")
    return catalog.get(slug) or catalog.get(label.lower())


async def create_user(session, item: dict, catalog: dict, now: datetime) -> User:
    existing = await session.execute(select(UserAuth).where(UserAuth.email == item["email"]))
    auth = existing.scalar_one_or_none()
    if auth:
        user = await session.get(User, auth.user_id)
        assert user is not None
        return user

    if item.get("city_key"):
        lat, lon, city, region, country = CITIES[item["city_key"]]
    else:
        lat, lon, city = DELHI[item["area"]]
        region, country = "Delhi NCR", "India"

    user = User(
        status=UserStatus.ACTIVE.value,
        onboarding_completed=True,
        onboarding_step="done",
        last_active_at=now - timedelta(minutes=2 if item["online"] else 180),
        created_at=now - timedelta(hours=6 if item["is_new"] else 240),
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

    body = dict(item["lifestyle"])
    body["heightRange"] = height_range(item["height"])
    profile = Profile(
        user_id=user.id,
        display_name=item["name"],
        bio=item["bio"],
        birth_date=birth_for(item["age"]),
        gender=item["gender"],
        orientation="straight",
        looking_for=item["goal"],
        show_orientation=True,
        languages=item.get("languages") or ["hindi", "english"],
        work_category=item["work"],
        job_title=item["job"],
        company=None,
        school=None,
        height_cm=item["height"],
        lifestyle=body,
        nationality=item["nationality"],
        verification_status=(
            VerificationStatus.VERIFIED.value if item["verified"] else VerificationStatus.UNVERIFIED.value
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
            region=region,
            country=country,
            location_updated_at=now,
        )
    )

    photos = [item["photo"], *EXTRA_PHOTOS]
    for index, url in enumerate(photos):
        session.add(
            ProfileMedia(
                profile_id=profile.id,
                url=url,
                thumbnail_url=url,
                storage_key=f"catalog/{user.id}/{index}-{uuid4().hex}.jpg",
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
            catalog[label.lower()] = interest
        session.add(ProfileInterest(profile_id=profile.id, interest_id=interest.id))

    return user


async def add_journey(session, user_id, item: dict, now: datetime) -> None:
    exists = await session.execute(
        select(TravelJourney).where(
            TravelJourney.user_id == user_id,
            TravelJourney.to_city == item["to_city"],
            TravelJourney.from_city == item["from_city"],
        )
    )
    if exists.scalar_one_or_none():
        return
    start = now + timedelta(days=item.get("days", 4))
    session.add(
        TravelJourney(
            user_id=user_id,
            from_city=item["from_city"],
            from_country=item["from_country"],
            to_city=item["to_city"],
            to_country=item["to_country"],
            departure=start.date().isoformat(),
            return_date=(start + timedelta(days=item.get("nights", 6))).date().isoformat(),
            trip_type=item["trip_type"],
            travel_style=item.get("travel_style", "solo"),
            companion=item.get("companion", "any"),
            status=item.get("status", "upcoming"),
            description=item["description"],
            cover_image=item.get("cover"),
            hide_from_country=bool(item.get("hide")),
        )
    )


async def add_tonight(session, user_id, item: dict, now: datetime) -> None:
    exists = await session.execute(
        select(TonightPost).where(
            TonightPost.user_id == user_id,
            TonightPost.venue == item["venue"],
        )
    )
    if exists.scalar_one_or_none():
        return
    session.add(
        TonightPost(
            user_id=user_id,
            activity=item["activity"],
            venue=item["venue"],
            tagline=item["tagline"],
            looking_for=item["looking_for"],
            meet_time=item.get("meet_time", "21:00"),
            featured_photo=item.get("photo"),
            expires_at=now + timedelta(hours=item.get("hours", 6)),
        )
    )


async def add_like(session, actor_id, target_id, superlike: bool = False) -> Like | None:
    if actor_id == target_id:
        return None
    exists = await session.execute(
        select(Like).where(Like.actor_id == actor_id, Like.target_id == target_id)
    )
    row = exists.scalar_one_or_none()
    if row:
        return row
    like = Like(actor_id=actor_id, target_id=target_id, is_superlike=superlike)
    session.add(like)
    await session.flush()
    return like


async def add_view(session, viewer_id, viewed_id) -> None:
    if viewer_id == viewed_id:
        return
    exists = await session.execute(
        select(ProfileView).where(
            ProfileView.viewer_id == viewer_id,
            ProfileView.viewed_id == viewed_id,
        )
    )
    if exists.scalar_one_or_none():
        return
    session.add(ProfileView(viewer_id=viewer_id, viewed_id=viewed_id))


async def notification_actor(session, user_id) -> dict:
    profile = await session.scalar(select(Profile).where(Profile.user_id == user_id))
    name = (profile.display_name if profile else None) or "Someone"
    photo = None
    if profile is not None:
        media = await session.scalar(
            select(ProfileMedia)
            .where(
                ProfileMedia.profile_id == profile.id,
                ProfileMedia.deleted_at.is_(None),
            )
            .order_by(ProfileMedia.is_primary.desc(), ProfileMedia.sort_order)
        )
        if media is not None:
            photo = media.url
    return {"userId": str(user_id), "user_id": str(user_id), "name": name, "photo": photo}


async def add_notification(
    session,
    user_id,
    ntype: str,
    title: str,
    body: str,
    event_key: str,
    data: dict | None = None,
    related_entity_id=None,
    related_entity_type: str | None = "user",
) -> None:
    exists = await session.execute(
        select(AppNotification).where(
            AppNotification.user_id == user_id,
            AppNotification.event_key == event_key,
        )
    )
    row = exists.scalar_one_or_none()
    payload = data or {}
    if row is not None:
        row.type = ntype
        row.title = title
        row.body = body
        row.data_json = {**(row.data_json or {}), **payload}
        if related_entity_id is not None:
            row.related_entity_type = related_entity_type
            row.related_entity_id = related_entity_id
        return
    session.add(
        AppNotification(
            user_id=user_id,
            type=ntype,
            title=title,
            body=body,
            data_json=payload,
            event_key=event_key,
            is_read=False,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
        )
    )


async def ensure_match_chat(session, left_id, right_id, messages: list[tuple]) -> None:
    if left_id == right_id:
        return
    a, b = (left_id, right_id) if left_id < right_id else (right_id, left_id)
    existing = await session.execute(
        select(Match).where(Match.user_a_id == a, Match.user_b_id == b)
    )
    match = existing.scalar_one_or_none()
    if match is None:
        match = Match(user_a_id=a, user_b_id=b, status=MatchStatus.ACTIVE.value)
        session.add(match)
        await session.flush()

    convo_row = await session.execute(
        select(Conversation).where(Conversation.match_id == match.id)
    )
    convo = convo_row.scalar_one_or_none()
    if convo is None:
        convo = Conversation(match_id=match.id)
        session.add(convo)
        await session.flush()

    for user_id in (a, b):
        member = await session.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == convo.id,
                ConversationMember.user_id == user_id,
            )
        )
        if member.scalar_one_or_none() is None:
            session.add(ConversationMember(conversation_id=convo.id, user_id=user_id))

    existing_messages = (
        await session.execute(select(Message).where(Message.conversation_id == convo.id))
    ).scalars().all()
    if existing_messages:
        return

    last = None
    for index, (sender_id, text) in enumerate(messages):
        last = Message(
            conversation_id=convo.id,
            sender_id=sender_id,
            client_message_id=f"seed-{convo.id}-{index}",
            message_type=MessageType.TEXT.value,
            content=text,
            status=MessageStatus.DELIVERED.value,
        )
        session.add(last)
    await session.flush()
    if last is not None:
        convo.last_message_at = datetime.now(UTC)
        convo.last_message_preview = last.content[:240]
        convo.last_message_id = last.id


async def main() -> None:
    settings = get_settings()
    if settings.app_env != AppEnv.DEVELOPMENT:
        raise SystemExit("seed_frontend_catalog.py is development-only")

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    created = 0

    async with factory() as session:
        catalog = await ensure_interests(session)
        now = datetime.now(UTC)

        for item in USERS:
            before = await session.execute(select(UserAuth).where(UserAuth.email == item["email"]))
            existed = before.scalar_one_or_none() is not None
            user = await create_user(session, item, catalog, now)
            if not existed:
                created += 1
            if item.get("online"):
                user.last_active_at = now - timedelta(minutes=1)
            elif item.get("online") is False:
                user.last_active_at = now - timedelta(hours=4)
        await session.flush()

        auths = (await session.execute(select(UserAuth))).scalars().all()
        by_email = {auth.email: auth.user_id for auth in auths}

        def uid(email: str):
            return by_email.get(email)

        for item in JOURNEYS:
            user_id = uid(item["email"])
            if user_id:
                await add_journey(session, user_id, item, now)

        for item in TONIGHT:
            user_id = uid(item["email"])
            if user_id:
                await add_tonight(session, user_id, item, now)

        stale = (
            await session.execute(
                select(TonightPost).where(
                    TonightPost.activity.in_(("party", "coffee", "walk", "dinner"))
                )
            )
        ).scalars().all()
        remap = {"party": "partyBuddy", "coffee": "drinks", "walk": "cityTour"}
        for row in stale:
            if row.activity in remap:
                row.activity = remap[row.activity]
            if row.expires_at is not None and row.expires_at < now:
                row.expires_at = now + timedelta(hours=8)

        all_user_ids = list({auth.user_id for auth in auths})
        real_ids = [
            auth.user_id
            for auth in auths
            if not any(auth.email.startswith(prefix) for prefix in PREFIXES)
        ]
        catalog_ids = [
            auth.user_id
            for auth in auths
            if any(auth.email.startswith(prefix) for prefix in PREFIXES)
        ]

        liker_ids = [uid(email) for email in INBOUND_LIKERS if uid(email)]
        viewer_ids = [uid(email) for email in VIEWERS if uid(email)]

        for target_id in all_user_ids:
            for index, actor_id in enumerate(liker_ids):
                if actor_id == target_id:
                    continue
                if index % 2 == 0 or target_id in real_ids:
                    await add_like(session, actor_id, target_id, superlike=index == 0)
            for viewer_id in viewer_ids:
                await add_view(session, viewer_id, target_id)

        catalog_pairs = [
            ("catalog.amara@boomboom.dev", "catalog.james@boomboom.dev"),
            ("catalog.priya@boomboom.dev", "catalog.chirag@boomboom.dev"),
            ("tonight.anaya@boomboom.dev", "tonight.dev@boomboom.dev"),
            ("travel.sofia@boomboom.dev", "travel.chandan@boomboom.dev"),
            ("catalog.mia@boomboom.dev", "catalog.kofi@boomboom.dev"),
            ("tonight.riya@boomboom.dev", "catalog.max@boomboom.dev"),
        ]
        for left_email, right_email in catalog_pairs:
            left, right = uid(left_email), uid(right_email)
            if not left or not right:
                continue
            await add_like(session, left, right)
            await add_like(session, right, left)
            await ensure_match_chat(
                session,
                left,
                right,
                [
                    (left, "Hey, your travel plans look fun. Coffee when you land?"),
                    (right, "Yes — I am free after 8. Khan Market?"),
                    (left, "Perfect. I will send the pin."),
                ],
            )

        partners = [uid(email) for email in MATCH_PARTNERS if uid(email)]
        for index, target_id in enumerate(real_ids):
            partner = partners[index % len(partners)] if partners else None
            if partner is None or partner == target_id:
                continue
            await add_like(session, partner, target_id)
            await add_like(session, target_id, partner)
            await ensure_match_chat(
                session,
                partner,
                target_id,
                [
                    (partner, "Hey! Just saw your profile — are you around Delhi this week?"),
                    (target_id, "Yes, I am. Want to grab a coffee?"),
                    (partner, "Connaught Place tomorrow evening works for me."),
                ],
            )
            journeys = (
                await session.execute(select(TravelJourney).where(TravelJourney.user_id == target_id))
            ).scalars().all()
            if not journeys:
                for template in MY_JOURNEY_TEMPLATES:
                    visible = dict(template)
                    visible["hide"] = False
                    await add_journey(session, target_id, visible, now)

            liker = next((item for item in liker_ids if item != target_id), partner)
            viewer = next((item for item in viewer_ids if item != target_id), partner)
            traveler = uid("travel.sofia@boomboom.dev") or partner
            host = uid("tonight.anaya@boomboom.dev") or partner
            like_actor = await notification_actor(session, liker)
            offer_actor = await notification_actor(session, liker)
            view_actor = await notification_actor(session, viewer)
            match_actor = await notification_actor(session, partner)
            travel_actor = await notification_actor(session, traveler)
            tonight_actor = await notification_actor(session, host)
            pair = (partner, target_id) if partner < target_id else (target_id, partner)
            match_row = await session.scalar(
                select(Match).where(Match.user_a_id == pair[0], Match.user_b_id == pair[1])
            )
            conversation_id = None
            if match_row is not None:
                convo_row = await session.scalar(
                    select(Conversation).where(Conversation.match_id == match_row.id)
                )
                if convo_row is not None:
                    conversation_id = str(convo_row.id)
            await add_notification(
                session,
                target_id,
                NotificationType.LIKE_RECEIVED.value,
                "New like",
                f"{like_actor['name']} liked your profile",
                f"seed-like-{target_id}",
                {"kind": "like", **like_actor},
                related_entity_id=liker,
            )
            await add_notification(
                session,
                target_id,
                NotificationType.OFFER_RECEIVED.value,
                "New offer",
                f"{offer_actor['name']} sent you a Super Like",
                f"seed-offer-{target_id}",
                {"kind": "offer", **offer_actor},
                related_entity_id=liker,
            )
            await add_notification(
                session,
                target_id,
                NotificationType.PROFILE_VIEW.value,
                "Profile view",
                f"{view_actor['name']} viewed your profile",
                f"seed-view-{target_id}",
                {"kind": "view", **view_actor},
                related_entity_id=viewer,
            )
            match_data = {"kind": "match", **match_actor}
            if conversation_id:
                match_data["conversationId"] = conversation_id
                match_data["conversation_id"] = conversation_id
            if match_row is not None:
                match_data["matchId"] = str(match_row.id)
            await add_notification(
                session,
                target_id,
                NotificationType.MATCH_CREATED.value,
                "It's a match",
                f"You and {match_actor['name']} liked each other",
                f"seed-match-{target_id}",
                match_data,
                related_entity_id=partner,
            )
            await add_notification(
                session,
                target_id,
                NotificationType.TRAVEL_UPDATE.value,
                "Travellers nearby",
                f"{travel_actor['name']} is heading to Delhi from Barcelona",
                f"seed-travel-{target_id}",
                {"kind": "travel", **travel_actor},
                related_entity_id=traveler,
            )
            await add_notification(
                session,
                target_id,
                NotificationType.EVENT_UPDATE.value,
                "Free tonight",
                f"{tonight_actor['name']} is free for dinner at Connaught Place",
                f"seed-tonight-{target_id}",
                {"kind": "tonight", **tonight_actor},
                related_entity_id=host,
            )
            await add_notification(
                session,
                target_id,
                NotificationType.NEW_MESSAGE.value,
                "New message",
                f"{match_actor['name']} sent you a message",
                f"seed-message-{target_id}",
                {
                    "kind": "message",
                    **match_actor,
                    **({"conversationId": conversation_id} if conversation_id else {}),
                },
                related_entity_id=partner,
            )

        extra_catalog_likes = [
            ("catalog.lena@boomboom.dev", "catalog.rey@boomboom.dev"),
            ("catalog.bhavya@boomboom.dev", "catalog.harsh@boomboom.dev"),
            ("tonight.sneha@boomboom.dev", "catalog.luc@boomboom.dev"),
            ("travel.maya@boomboom.dev", "catalog.noah.ca@boomboom.dev"),
        ]
        for actor_email, target_email in extra_catalog_likes:
            actor_id, target_id = uid(actor_email), uid(target_email)
            if actor_id and target_id:
                await add_like(session, actor_id, target_id)

        await session.commit()
        print(f"Seeded {created} new catalog users. Password: {PASSWORD}")
        print(f"Catalog/travel/tonight accounts: {len(catalog_ids)}")
        print("Existing accounts received likes, views, matches, chats, and notifications.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
