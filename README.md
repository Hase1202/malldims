# AGMall Distribution Inventory Management System

## Prerequisites
1. [Node.js](https://nodejs.org/en/download)
2. [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
3. [Python](https://www.python.org/downloads/)
4. [PostgreSQL](https://www.postgresql.org/download/) (install locally)

## Frontend setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Backend setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Set up .env file
cp .env.example .env  # Update with your local PostgreSQL credentials

# Run migrations
python manage.py migrate
```

## Database setup
Set up a local PostgreSQL database. Update your `.env` file in the backend directory with your local database credentials:

```
DB_NAME=your_db_name
DB_USER=your_username
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

You can create a database using the PostgreSQL command line or a GUI tool like pgAdmin.

### Accessing PostgreSQL
#### Using psql CLI:
```bash
# Connect to your local database
psql -h localhost -U your_username -d your_db_name
```

#### Using Django:
```bash
# Run migrations to set up tables
python manage.py migrate
```

## API Endpoints
### Inventory Items
```bash
# List all items
GET /api/items/

# Supported query parameters
?page=1               # Pagination
?search=keyword      # Search items
?item_type=type      # Filter by type
?category=category   # Filter by category
?availability=status # Filter by availability
```

## Project Structure
### Backend
```bash
backend/
├── config/             # Project configuration
├── inventory/          # Main app directory
│   ├── models.py      # Database models
│   ├── serializers.py # API serializers
│   ├── views.py       # API views
│   └── urls.py        # API routing
└── manage.py
```

### Frontend
```bash
frontend/
├── node_modules/
├── public/
├── src/
│   ├── assets/          # Static files (images, etc.)
│   ├── components/
│   │   ├── common/      # Shared components
│   │   └── features/    # Feature-specific components (e.g. Inventory)
│   ├── pages/           # Page components
│   ├── types/           # TypeScript type definitions
│   ├── index.css        # Global styles
│   ├── main.tsx         # App entry point
├── .gitignore
├── index.html           # HTML file
└── package.json
```