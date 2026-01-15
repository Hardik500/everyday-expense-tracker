SEED_CATEGORIES = {
    "Housing": ["Rent", "Maintenance", "Utilities"],
    "Transportation": ["Fuel", "Ride Share", "Public Transit", "Parking"],
    "Food": ["Groceries", "Dining Out", "Delivery"],
    "Health": ["Pharmacy", "Doctor", "Insurance"],
    "Entertainment": ["Movies", "Games", "Subscriptions"],
    "Shopping": ["Clothing", "Electronics", "Home"],
    "Travel": ["Flights", "Hotels", "Local Transit"],
    "Income": ["Salary", "Interest", "Refunds"],
    "Miscellaneous": ["Other"],
}

SEED_RULES = [
    {
        "name": "Grocery stores",
        "pattern": r"(GROCERY|SUPERMARKET|BIGBASKET|DMART|FRESHTOHOME)",
        "category": "Food",
        "subcategory": "Groceries",
        "priority": 70,
    },
    {
        "name": "Dining out",
        "pattern": r"(RESTAURANT|CAFE|SWIGGY|ZOMATO)",
        "category": "Food",
        "subcategory": "Dining Out",
        "priority": 65,
    },
    {
        "name": "Fuel",
        "pattern": r"(FUEL|PETROL|DIESEL|INDIANOIL|HPCL|IOCL)",
        "category": "Transportation",
        "subcategory": "Fuel",
        "priority": 70,
    },
    {
        "name": "Ride share",
        "pattern": r"(UBER|OLA|RAPIDO)",
        "category": "Transportation",
        "subcategory": "Ride Share",
        "priority": 60,
    },
    {
        "name": "Salary",
        "pattern": r"(SALARY|PAYROLL)",
        "category": "Income",
        "subcategory": "Salary",
        "priority": 80,
    },
    {
        "name": "Card payment",
        "pattern": r"(CREDIT CARD PAYMENT|CARD PAYMENT|CC PAYMENT)",
        "category": "Miscellaneous",
        "subcategory": "Other",
        "priority": 40,
    },
]
