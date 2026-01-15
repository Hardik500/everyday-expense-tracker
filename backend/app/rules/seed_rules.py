# Comprehensive categories and subcategories for Indian expense tracking
SEED_CATEGORIES = {
    # Housing & Utilities
    "Housing": [
        "Rent",
        "Home Loan EMI",
        "Property Tax",
        "Society Maintenance",
        "Home Repairs",
        "Interiors & Furniture",
        "Home Security",
        "Brokerage",
    ],
    "Utilities": [
        "Electricity",
        "Water",
        "Gas",
        "Internet & Broadband",
        "Mobile Recharge",
        "DTH & Cable",
        "Landline",
    ],
    
    # Transportation
    "Transportation": [
        "Petrol & Diesel",
        "CNG",
        "Uber & Ola",
        "Rapido & Bike Taxi",
        "Auto Rickshaw",
        "Metro",
        "Local Train",
        "Bus",
        "Parking",
        "Toll",
        "Vehicle Service",
        "Vehicle Insurance",
        "Vehicle EMI",
        "Fastag Recharge",
    ],
    
    # Food & Dining
    "Food & Dining": [
        "Groceries",
        "Vegetables & Fruits",
        "Milk & Dairy",
        "Restaurant",
        "Cafe & Coffee",
        "Swiggy & Zomato",
        "Street Food",
        "Office Meals",
        "Alcohol & Bars",
        "Bakery & Sweets",
    ],
    
    # Shopping
    "Shopping": [
        "Clothing & Apparel",
        "Footwear",
        "Electronics",
        "Mobile & Accessories",
        "Appliances",
        "Kitchenware",
        "Home Decor",
        "Books & Stationery",
        "Toys & Games",
        "Jewelry",
        "Watches",
        "Bags & Luggage",
        "Sports Equipment",
        "Amazon",
        "Flipkart",
        "Myntra",
        "Other E-commerce",
    ],
    
    # Health & Wellness
    "Health & Wellness": [
        "Doctor Consultation",
        "Hospital",
        "Pharmacy & Medicines",
        "Lab Tests & Diagnostics",
        "Health Insurance Premium",
        "Gym & Fitness",
        "Yoga & Classes",
        "Ayurveda & Wellness",
        "Mental Health",
        "Dental",
        "Eye Care & Opticals",
        "Physiotherapy",
    ],
    
    # Entertainment & Leisure
    "Entertainment": [
        "Movies & Cinema",
        "Netflix & OTT",
        "Spotify & Music",
        "Gaming",
        "Concerts & Events",
        "Theme Parks",
        "Hobbies",
        "Club Membership",
        "Books & Kindle",
    ],
    
    # Travel
    "Travel": [
        "Flights",
        "Train Tickets",
        "Bus Tickets",
        "Hotels & Stays",
        "Airbnb",
        "Travel Insurance",
        "Visa & Passport",
        "Tour Packages",
        "Local Sightseeing",
        "Travel Accessories",
    ],
    
    # Education
    "Education": [
        "School Fees",
        "College Fees",
        "Tuition & Coaching",
        "Online Courses",
        "Books & Study Material",
        "Certification Exams",
        "Workshops & Seminars",
        "Education Loan EMI",
    ],
    
    # Personal Care
    "Personal Care": [
        "Salon & Haircut",
        "Spa & Massage",
        "Skincare & Cosmetics",
        "Grooming Products",
        "Personal Hygiene",
    ],
    
    # Financial Services
    "Financial Services": [
        "Bank Charges",
        "Credit Card Fees",
        "Locker Rent",
        "Forex & Currency",
        "Advisory Fees",
        "Interest Paid",
        "Late Payment Fees",
        "ATM Charges",
    ],
    
    # Insurance
    "Insurance": [
        "Life Insurance",
        "Term Insurance",
        "Health Insurance",
        "Vehicle Insurance",
        "Home Insurance",
        "Travel Insurance",
    ],
    
    # Investments
    "Investments": [
        "Mutual Funds SIP",
        "Stocks & Shares",
        "Fixed Deposits",
        "PPF & NPS",
        "Gold & Bonds",
        "Real Estate",
        "Crypto",
    ],
    
    # Family & Social
    "Family & Social": [
        "Gifts",
        "Donations & Charity",
        "Religious & Puja",
        "Wedding & Functions",
        "Kids Activities",
        "Pet Care",
        "Pocket Money",
        "Family Support",
    ],
    
    # Professional & Work
    "Professional": [
        "Professional Fees",
        "Software & Tools",
        "Coworking Space",
        "Office Supplies",
        "Business Travel",
        "Client Entertainment",
        "Training & Development",
    ],
    
    # Government & Taxes
    "Government & Taxes": [
        "Income Tax",
        "GST",
        "Property Tax",
        "Professional Tax",
        "Government Fees",
        "Fines & Penalties",
        "Stamp Duty",
    ],
    
    # Loans & EMIs
    "Loans & EMIs": [
        "Home Loan",
        "Personal Loan",
        "Car Loan",
        "Education Loan",
        "Credit Card EMI",
        "Consumer Loan",
    ],
    
    # Income
    "Income": [
        "Salary",
        "Bonus",
        "Freelance Income",
        "Business Income",
        "Rental Income",
        "Interest Income",
        "Dividend",
        "Cashback & Rewards",
        "Refunds",
        "Gift Received",
        "Investment Returns",
    ],
    
    # Transfers (Internal)
    "Transfers": [
        "Account Transfer",
        "Credit Card Payment",
        "Wallet Transfer",
        "Investment Transfer",
        "Family Transfer",
    ],
    
    # Miscellaneous
    "Miscellaneous": [
        "ATM Withdrawal",
        "Cash Deposit",
        "Uncategorized",
        "Other Expenses",
        "Unknown",
    ],
}

# Comprehensive regex rules for automatic categorization
SEED_RULES = [
    # Food & Dining - Groceries
    {"name": "BigBasket", "pattern": r"BIGBASKET|BIG\s*BASKET", "category": "Food & Dining", "subcategory": "Groceries", "priority": 80},
    {"name": "DMart", "pattern": r"DMART|D\s*MART|AVENUE\s*SUPERMARTS", "category": "Food & Dining", "subcategory": "Groceries", "priority": 80},
    {"name": "More Supermarket", "pattern": r"MORE\s*(RETAIL|SUPERMARKET|MEGA)", "category": "Food & Dining", "subcategory": "Groceries", "priority": 75},
    {"name": "Reliance Fresh", "pattern": r"RELIANCE\s*(FRESH|SMART|RETAIL)", "category": "Food & Dining", "subcategory": "Groceries", "priority": 75},
    {"name": "Spencer's", "pattern": r"SPENCER", "category": "Food & Dining", "subcategory": "Groceries", "priority": 70},
    {"name": "Nature's Basket", "pattern": r"NATURE.*BASKET|GODREJ\s*NATURE", "category": "Food & Dining", "subcategory": "Groceries", "priority": 75},
    {"name": "Zepto", "pattern": r"ZEPTO", "category": "Food & Dining", "subcategory": "Groceries", "priority": 80},
    {"name": "Blinkit", "pattern": r"BLINKIT|GROFERS", "category": "Food & Dining", "subcategory": "Groceries", "priority": 80},
    {"name": "Instamart", "pattern": r"INSTAMART|SWIGGY\s*INSTA", "category": "Food & Dining", "subcategory": "Groceries", "priority": 80},
    {"name": "JioMart", "pattern": r"JIOMART|JIO\s*MART", "category": "Food & Dining", "subcategory": "Groceries", "priority": 75},
    {"name": "FreshToHome", "pattern": r"FRESHTOHOME|FRESH\s*TO\s*HOME", "category": "Food & Dining", "subcategory": "Vegetables & Fruits", "priority": 75},
    {"name": "Licious", "pattern": r"LICIOUS", "category": "Food & Dining", "subcategory": "Groceries", "priority": 75},
    {"name": "Country Delight", "pattern": r"COUNTRY\s*DELIGHT", "category": "Food & Dining", "subcategory": "Milk & Dairy", "priority": 75},
    
    # Food & Dining - Food Delivery
    {"name": "Swiggy", "pattern": r"SWIGGY(?!\s*INSTA)", "category": "Food & Dining", "subcategory": "Swiggy & Zomato", "priority": 80},
    {"name": "Zomato", "pattern": r"ZOMATO", "category": "Food & Dining", "subcategory": "Swiggy & Zomato", "priority": 80},
    {"name": "Uber Eats", "pattern": r"UBER\s*EATS", "category": "Food & Dining", "subcategory": "Swiggy & Zomato", "priority": 75},
    {"name": "Dominos", "pattern": r"DOMINO", "category": "Food & Dining", "subcategory": "Swiggy & Zomato", "priority": 70},
    {"name": "Pizza Hut", "pattern": r"PIZZA\s*HUT", "category": "Food & Dining", "subcategory": "Restaurant", "priority": 70},
    {"name": "McDonalds", "pattern": r"MCDONALD|MCD\s", "category": "Food & Dining", "subcategory": "Restaurant", "priority": 70},
    {"name": "KFC", "pattern": r"\bKFC\b", "category": "Food & Dining", "subcategory": "Restaurant", "priority": 70},
    {"name": "Burger King", "pattern": r"BURGER\s*KING", "category": "Food & Dining", "subcategory": "Restaurant", "priority": 70},
    {"name": "Subway", "pattern": r"SUBWAY", "category": "Food & Dining", "subcategory": "Restaurant", "priority": 70},
    
    # Food & Dining - Cafes
    {"name": "Starbucks", "pattern": r"STARBUCKS", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 75},
    {"name": "CCD", "pattern": r"CAFE\s*COFFEE\s*DAY|CCD", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 75},
    {"name": "Costa Coffee", "pattern": r"COSTA", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 70},
    {"name": "Barista", "pattern": r"BARISTA", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 70},
    {"name": "Third Wave", "pattern": r"THIRD\s*WAVE", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 70},
    {"name": "Blue Tokai", "pattern": r"BLUE\s*TOKAI", "category": "Food & Dining", "subcategory": "Cafe & Coffee", "priority": 70},
    
    # Food & Dining - Alcohol
    {"name": "Wine Shop", "pattern": r"WINE\s*SHOP|LIQUOR|BEVERAGES|SPIRITS", "category": "Food & Dining", "subcategory": "Alcohol & Bars", "priority": 60},
    {"name": "Beer Cafe", "pattern": r"BEER\s*CAFE|TOIT|ARBOR|SOCIAL\s*OFFLINE", "category": "Food & Dining", "subcategory": "Alcohol & Bars", "priority": 65},
    
    # Transportation - Fuel
    {"name": "Indian Oil", "pattern": r"INDIAN\s*OIL|IOCL|IOC\s", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 80},
    {"name": "HP Petrol", "pattern": r"HP\s*PETROL|HPCL|HINDUSTAN\s*PETROLEUM", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 80},
    {"name": "Bharat Petroleum", "pattern": r"BHARAT\s*PETROLEUM|BPCL|BP\s*PETROL", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 80},
    {"name": "Reliance Petrol", "pattern": r"RELIANCE\s*(PETROL|FUEL)", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 75},
    {"name": "Shell", "pattern": r"SHELL\s*(PETROL|FUEL)?", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 70},
    {"name": "Fuel Generic", "pattern": r"PETROL|DIESEL|FUEL\s*STATION", "category": "Transportation", "subcategory": "Petrol & Diesel", "priority": 60},
    
    # Transportation - Ride Hailing
    {"name": "Uber", "pattern": r"UBER(?!\s*EATS)", "category": "Transportation", "subcategory": "Uber & Ola", "priority": 80},
    {"name": "Ola", "pattern": r"\bOLA\b|OLA\s*CABS", "category": "Transportation", "subcategory": "Uber & Ola", "priority": 80},
    {"name": "Rapido", "pattern": r"RAPIDO", "category": "Transportation", "subcategory": "Rapido & Bike Taxi", "priority": 75},
    {"name": "Namma Yatri", "pattern": r"NAMMA\s*YATRI", "category": "Transportation", "subcategory": "Auto Rickshaw", "priority": 70},
    
    # Transportation - Public Transit
    {"name": "Metro", "pattern": r"METRO\s*(RAIL|CARD)?|DMRC|BMRC|CMRL|MAHA\s*METRO", "category": "Transportation", "subcategory": "Metro", "priority": 75},
    {"name": "IRCTC", "pattern": r"IRCTC|INDIAN\s*RAILWAY", "category": "Travel", "subcategory": "Train Tickets", "priority": 80},
    {"name": "RedBus", "pattern": r"REDBUS|RED\s*BUS", "category": "Travel", "subcategory": "Bus Tickets", "priority": 75},
    {"name": "AbhiBus", "pattern": r"ABHIBUS", "category": "Travel", "subcategory": "Bus Tickets", "priority": 75},
    
    # Transportation - Parking & Toll
    {"name": "Fastag", "pattern": r"FASTAG|FAS\s*TAG|NETC|TOLL", "category": "Transportation", "subcategory": "Toll", "priority": 75},
    {"name": "Parking", "pattern": r"PARKING|PARKPLUS|PARK\+", "category": "Transportation", "subcategory": "Parking", "priority": 70},
    
    # Shopping - E-commerce
    {"name": "Amazon", "pattern": r"AMAZON|AMZN|AMZ\s", "category": "Shopping", "subcategory": "Amazon", "priority": 80},
    {"name": "Flipkart", "pattern": r"FLIPKART|FLIP\s*KART", "category": "Shopping", "subcategory": "Flipkart", "priority": 80},
    {"name": "Myntra", "pattern": r"MYNTRA", "category": "Shopping", "subcategory": "Myntra", "priority": 80},
    {"name": "Ajio", "pattern": r"AJIO", "category": "Shopping", "subcategory": "Clothing & Apparel", "priority": 75},
    {"name": "Nykaa", "pattern": r"NYKAA", "category": "Personal Care", "subcategory": "Skincare & Cosmetics", "priority": 75},
    {"name": "Meesho", "pattern": r"MEESHO", "category": "Shopping", "subcategory": "Other E-commerce", "priority": 70},
    {"name": "Tata CLiQ", "pattern": r"TATA\s*CLIQ|TATACLIQ", "category": "Shopping", "subcategory": "Other E-commerce", "priority": 70},
    
    # Shopping - Electronics
    {"name": "Croma", "pattern": r"CROMA", "category": "Shopping", "subcategory": "Electronics", "priority": 75},
    {"name": "Reliance Digital", "pattern": r"RELIANCE\s*DIGITAL", "category": "Shopping", "subcategory": "Electronics", "priority": 75},
    {"name": "Vijay Sales", "pattern": r"VIJAY\s*SALES", "category": "Shopping", "subcategory": "Electronics", "priority": 70},
    {"name": "Apple Store", "pattern": r"APPLE\s*(STORE|INDIA)", "category": "Shopping", "subcategory": "Mobile & Accessories", "priority": 75},
    
    # Shopping - Furniture & Home
    {"name": "IKEA", "pattern": r"IKEA", "category": "Shopping", "subcategory": "Home Decor", "priority": 75},
    {"name": "Pepperfry", "pattern": r"PEPPERFRY", "category": "Shopping", "subcategory": "Home Decor", "priority": 70},
    {"name": "Urban Ladder", "pattern": r"URBAN\s*LADDER", "category": "Shopping", "subcategory": "Home Decor", "priority": 70},
    
    # Utilities
    {"name": "Electricity Bill", "pattern": r"ELECTRICITY|BESCOM|TATA\s*POWER|ADANI\s*ELECTRICITY|TORRENT\s*POWER|BSES|MSEDCL", "category": "Utilities", "subcategory": "Electricity", "priority": 75},
    {"name": "Piped Gas", "pattern": r"PNG|PIPED\s*GAS|MAHANAGAR\s*GAS|IGL|ADANI\s*GAS", "category": "Utilities", "subcategory": "Gas", "priority": 75},
    {"name": "Water Bill", "pattern": r"WATER\s*(BILL|BOARD)|BWSSB|MCGM", "category": "Utilities", "subcategory": "Water", "priority": 70},
    {"name": "Internet", "pattern": r"ACT\s*FIBERNET|AIRTEL\s*FIBER|JIO\s*FIBER|HATHWAY|TATA\s*SKY\s*BROADBAND", "category": "Utilities", "subcategory": "Internet & Broadband", "priority": 75},
    {"name": "Mobile Recharge", "pattern": r"AIRTEL|JIO|VODAFONE|VI\s|BSNL|MOBILE\s*RECHARGE", "category": "Utilities", "subcategory": "Mobile Recharge", "priority": 65},
    {"name": "DTH", "pattern": r"TATA\s*SKY|AIRTEL\s*DTH|DISH\s*TV|VIDEOCON|SUN\s*DIRECT|DTH\s*RECHARGE", "category": "Utilities", "subcategory": "DTH & Cable", "priority": 70},
    
    # Entertainment - OTT
    {"name": "Netflix", "pattern": r"NETFLIX", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 80},
    {"name": "Amazon Prime", "pattern": r"PRIME\s*VIDEO|AMAZON\s*PRIME", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 75},
    {"name": "Hotstar", "pattern": r"HOTSTAR|DISNEY\s*PLUS", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 75},
    {"name": "Sony LIV", "pattern": r"SONY\s*LIV", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 70},
    {"name": "Zee5", "pattern": r"ZEE5|ZEE\s*5", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 70},
    {"name": "Spotify", "pattern": r"SPOTIFY", "category": "Entertainment", "subcategory": "Spotify & Music", "priority": 75},
    {"name": "YouTube Premium", "pattern": r"YOUTUBE\s*PREMIUM|GOOGLE\s*YOUTUBE", "category": "Entertainment", "subcategory": "Netflix & OTT", "priority": 70},
    {"name": "Apple Music", "pattern": r"APPLE\s*MUSIC|ITUNES", "category": "Entertainment", "subcategory": "Spotify & Music", "priority": 70},
    
    # Entertainment - Movies
    {"name": "BookMyShow", "pattern": r"BOOKMYSHOW|BMS\s", "category": "Entertainment", "subcategory": "Movies & Cinema", "priority": 75},
    {"name": "PVR", "pattern": r"PVR\s*(CINEMA|INOX)?", "category": "Entertainment", "subcategory": "Movies & Cinema", "priority": 75},
    {"name": "INOX", "pattern": r"INOX", "category": "Entertainment", "subcategory": "Movies & Cinema", "priority": 75},
    {"name": "Cinepolis", "pattern": r"CINEPOLIS", "category": "Entertainment", "subcategory": "Movies & Cinema", "priority": 70},
    
    # Health & Wellness
    {"name": "Apollo Pharmacy", "pattern": r"APOLLO\s*PHARMACY|APOLLO\s*24", "category": "Health & Wellness", "subcategory": "Pharmacy & Medicines", "priority": 75},
    {"name": "Netmeds", "pattern": r"NETMEDS", "category": "Health & Wellness", "subcategory": "Pharmacy & Medicines", "priority": 75},
    {"name": "PharmEasy", "pattern": r"PHARMEASY|PHARM\s*EASY", "category": "Health & Wellness", "subcategory": "Pharmacy & Medicines", "priority": 75},
    {"name": "1mg", "pattern": r"1MG|ONEMG|TATA\s*1MG", "category": "Health & Wellness", "subcategory": "Pharmacy & Medicines", "priority": 75},
    {"name": "Medplus", "pattern": r"MEDPLUS|MED\s*PLUS", "category": "Health & Wellness", "subcategory": "Pharmacy & Medicines", "priority": 70},
    {"name": "Practo", "pattern": r"PRACTO", "category": "Health & Wellness", "subcategory": "Doctor Consultation", "priority": 70},
    {"name": "Hospital", "pattern": r"HOSPITAL|CLINIC|DIAGNOSTIC|LABS|HEALTHCARE", "category": "Health & Wellness", "subcategory": "Hospital", "priority": 60},
    {"name": "Gym", "pattern": r"GYM|FITNESS|CULT\.?FIT|CURE\.?FIT|GOLD\s*GYM", "category": "Health & Wellness", "subcategory": "Gym & Fitness", "priority": 70},
    
    # Travel - Flights
    {"name": "MakeMyTrip", "pattern": r"MAKEMYTRIP|MMT\s", "category": "Travel", "subcategory": "Flights", "priority": 75},
    {"name": "Goibibo", "pattern": r"GOIBIBO", "category": "Travel", "subcategory": "Flights", "priority": 75},
    {"name": "Cleartrip", "pattern": r"CLEARTRIP", "category": "Travel", "subcategory": "Flights", "priority": 70},
    {"name": "Yatra", "pattern": r"YATRA", "category": "Travel", "subcategory": "Flights", "priority": 70},
    {"name": "IndiGo", "pattern": r"INDIGO|6E\s*AIR", "category": "Travel", "subcategory": "Flights", "priority": 75},
    {"name": "SpiceJet", "pattern": r"SPICEJET", "category": "Travel", "subcategory": "Flights", "priority": 75},
    {"name": "Air India", "pattern": r"AIR\s*INDIA", "category": "Travel", "subcategory": "Flights", "priority": 75},
    {"name": "Vistara", "pattern": r"VISTARA", "category": "Travel", "subcategory": "Flights", "priority": 75},
    
    # Travel - Hotels
    {"name": "OYO", "pattern": r"OYO\s*(ROOMS|HOTELS)?", "category": "Travel", "subcategory": "Hotels & Stays", "priority": 75},
    {"name": "Airbnb", "pattern": r"AIRBNB", "category": "Travel", "subcategory": "Airbnb", "priority": 75},
    {"name": "Booking.com", "pattern": r"BOOKING\.COM|BOOKINGCOM", "category": "Travel", "subcategory": "Hotels & Stays", "priority": 70},
    {"name": "Agoda", "pattern": r"AGODA", "category": "Travel", "subcategory": "Hotels & Stays", "priority": 70},
    
    # Education
    {"name": "Udemy", "pattern": r"UDEMY", "category": "Education", "subcategory": "Online Courses", "priority": 70},
    {"name": "Coursera", "pattern": r"COURSERA", "category": "Education", "subcategory": "Online Courses", "priority": 70},
    {"name": "Unacademy", "pattern": r"UNACADEMY", "category": "Education", "subcategory": "Tuition & Coaching", "priority": 70},
    {"name": "Byju's", "pattern": r"BYJU|THINK\s*LEARN", "category": "Education", "subcategory": "Tuition & Coaching", "priority": 70},
    
    # Insurance
    {"name": "LIC", "pattern": r"LIC\s*(OF\s*INDIA)?|LIFE\s*INSURANCE", "category": "Insurance", "subcategory": "Life Insurance", "priority": 75},
    {"name": "HDFC Life", "pattern": r"HDFC\s*LIFE", "category": "Insurance", "subcategory": "Life Insurance", "priority": 70},
    {"name": "ICICI Prudential", "pattern": r"ICICI\s*PRUDENTIAL|ICICI\s*PRU", "category": "Insurance", "subcategory": "Life Insurance", "priority": 70},
    {"name": "Health Insurance", "pattern": r"HEALTH\s*INSURANCE|MEDICLAIM|STAR\s*HEALTH", "category": "Insurance", "subcategory": "Health Insurance", "priority": 70},
    
    # Investments
    {"name": "Mutual Fund SIP", "pattern": r"SIP|MUTUAL\s*FUND|MF\s*PURCHASE", "category": "Investments", "subcategory": "Mutual Funds SIP", "priority": 70},
    {"name": "Zerodha", "pattern": r"ZERODHA", "category": "Investments", "subcategory": "Stocks & Shares", "priority": 75},
    {"name": "Groww", "pattern": r"GROWW", "category": "Investments", "subcategory": "Mutual Funds SIP", "priority": 75},
    {"name": "Kuvera", "pattern": r"KUVERA", "category": "Investments", "subcategory": "Mutual Funds SIP", "priority": 70},
    {"name": "CAMS", "pattern": r"CAMS|COMPUTER\s*AGE\s*MANAGEMENT", "category": "Investments", "subcategory": "Mutual Funds SIP", "priority": 65},
    {"name": "NSDL", "pattern": r"NSDL|CDSL", "category": "Investments", "subcategory": "Stocks & Shares", "priority": 65},
    {"name": "NPS", "pattern": r"NPS|NATIONAL\s*PENSION|PFRDA", "category": "Investments", "subcategory": "PPF & NPS", "priority": 70},
    
    # Income
    {"name": "Salary", "pattern": r"SALARY|PAYROLL|NEFT\s*INW", "category": "Income", "subcategory": "Salary", "priority": 80},
    {"name": "Interest Credit", "pattern": r"INTEREST\s*(CREDIT|PAID)|INT\s*PAID|INTEREST\s*ON", "category": "Income", "subcategory": "Interest Income", "priority": 70},
    {"name": "Dividend", "pattern": r"DIVIDEND", "category": "Income", "subcategory": "Dividend", "priority": 70},
    {"name": "Cashback", "pattern": r"CASHBACK|CASH\s*BACK|REWARD", "category": "Income", "subcategory": "Cashback & Rewards", "priority": 65},
    {"name": "Refund", "pattern": r"REFUND|REVERSAL", "category": "Income", "subcategory": "Refunds", "priority": 65},
    
    # Transfers
    {"name": "Credit Card Payment", "pattern": r"CREDIT\s*CARD\s*PAYMENT|CC\s*PAYMENT|CARD\s*BILL", "category": "Transfers", "subcategory": "Credit Card Payment", "priority": 80},
    {"name": "UPI Transfer", "pattern": r"UPI|GPAY|GOOGLE\s*PAY|PHONEPE|PAYTM(?!\s*MALL)", "category": "Transfers", "subcategory": "Account Transfer", "priority": 50},
    {"name": "NEFT", "pattern": r"NEFT(?!\s*INW)|RTGS|IMPS", "category": "Transfers", "subcategory": "Account Transfer", "priority": 50},
    
    # Financial Services
    {"name": "Bank Charges", "pattern": r"SERVICE\s*CHARGE|BANK\s*CHARGE|MAINTENANCE\s*CHARGE|SMS\s*CHARGE", "category": "Financial Services", "subcategory": "Bank Charges", "priority": 70},
    {"name": "ATM Fee", "pattern": r"ATM\s*(FEE|CHARGE)", "category": "Financial Services", "subcategory": "ATM Charges", "priority": 65},
    {"name": "Interest Charges", "pattern": r"INTEREST\s*CHARGE|FIN\s*CHARGE|FINANCE\s*CHARGE", "category": "Financial Services", "subcategory": "Interest Paid", "priority": 70},
    {"name": "Late Fee", "pattern": r"LATE\s*(FEE|PAYMENT)|PENALTY", "category": "Financial Services", "subcategory": "Late Payment Fees", "priority": 70},
    
    # Loans & EMIs
    {"name": "EMI", "pattern": r"EMI|EQUATED\s*MONTHLY", "category": "Loans & EMIs", "subcategory": "Consumer Loan", "priority": 65},
    {"name": "Home Loan", "pattern": r"HOME\s*LOAN|HOUSING\s*LOAN", "category": "Loans & EMIs", "subcategory": "Home Loan", "priority": 75},
    {"name": "Personal Loan", "pattern": r"PERSONAL\s*LOAN", "category": "Loans & EMIs", "subcategory": "Personal Loan", "priority": 70},
    
    # Government & Taxes
    {"name": "Income Tax", "pattern": r"INCOME\s*TAX|ADVANCE\s*TAX|TDS|I\.?T\.?\s*DEPT", "category": "Government & Taxes", "subcategory": "Income Tax", "priority": 75},
    {"name": "GST", "pattern": r"GST|GOODS\s*AND\s*SERVICE", "category": "Government & Taxes", "subcategory": "GST", "priority": 70},
    
    # Miscellaneous
    {"name": "ATM Withdrawal", "pattern": r"ATM\s*(WDL|WITHDRAWAL|WDR|CASH)", "category": "Miscellaneous", "subcategory": "ATM Withdrawal", "priority": 70},
    {"name": "Cash Deposit", "pattern": r"CASH\s*DEPOSIT|CDM", "category": "Miscellaneous", "subcategory": "Cash Deposit", "priority": 70},
    
    # Housing
    {"name": "Rent Payment", "pattern": r"RENT|HOUSE\s*RENT|HRA", "category": "Housing", "subcategory": "Rent", "priority": 65},
    {"name": "Society", "pattern": r"SOCIETY|MAINTENANCE|ASSOC", "category": "Housing", "subcategory": "Society Maintenance", "priority": 65},
    
    # Personal Care
    {"name": "Salon", "pattern": r"SALON|PARLOUR|HAIR\s*CUT|BARBER|NATURALS|GREEN\s*TRENDS|JAWED\s*HABIB", "category": "Personal Care", "subcategory": "Salon & Haircut", "priority": 70},
    {"name": "Urban Company", "pattern": r"URBAN\s*COMPANY|URBANCLAP", "category": "Personal Care", "subcategory": "Salon & Haircut", "priority": 70},
    
    # Family & Social
    {"name": "Gifts", "pattern": r"GIFT", "category": "Family & Social", "subcategory": "Gifts", "priority": 50},
    {"name": "Donation", "pattern": r"DONATION|CHARITY|NGO", "category": "Family & Social", "subcategory": "Donations & Charity", "priority": 60},
]
