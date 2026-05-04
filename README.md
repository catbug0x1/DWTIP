# DWTIP - Dark Web Threat Intelligence Platform

A production-ready cyber threat intelligence platform for monitoring dark web threats, ransomware leaks, and cybercriminal activities.

## Features

- **Data Collection**: Automated scraping from ransomware blogs, hacker forums, marketplaces, and cyber news sources
- **IOC Extraction**: Automatic extraction of IPs, domains, emails, wallets, and hashes
- **Threat Actor Tracking**: Profile management for ransomware groups and cybercriminal organizations
- **Real-time Alerts**: Configurable alerts for keyword matches and new threats
- **Modern Dashboard**: React-based dashboard with visualizations and real-time updates
- **Scalable Architecture**: Docker-based microservices with Celery task queues

## Architecture
## test
```
dwtip/
├── backend/
│   ├── api/           # FastAPI application
│   ├── core/         # Configuration and database
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── scrapers/      # Web scraping modules
│   ├── services/      # NLP and IOC extraction
│   └── workers/       # Celery tasks
├── frontend/          # React + Tailwind dashboard
├── database/
│   ├── mongodb/       # MongoDB initialization
│   └── postgresql/    # PostgreSQL initialization
├── docker/            # Docker configurations
├── config/            # Environment templates
└── scripts/           # Utility scripts
```

## Quick Start

### Docker Deployment (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd dwtip
```

2. Copy environment file:
```bash
cp config/.env.example .env
```

3. Edit `.env` with your configuration:
```env
SECRET_KEY=your-secure-random-key
DATABASE_URL=postgresql://dwtip:your-password@localhost:5432/dwtip
MONGODB_URL=mongodb://localhost:27017/dwtip
```

4. Start with Docker Compose:
```bash
docker-compose up -d
```

5. Access the platform:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Manual Installation

1. Install dependencies:
```bash
./setup.sh
```

2. Start services:
```bash
# PostgreSQL
sudo systemctl start postgresql

# MongoDB
sudo systemctl start mongodb

# Redis
sudo systemctl start redis

# Tor
sudo systemctl start tor
```

3. Run the backend:
```bash
cd backend
uvicorn api.main:app --reload
```

4. Run the frontend:
```bash
cd frontend
npm start
```

## Default Credentials

After seeding:
- Username: `admin`
- Password: `admin123`

**Change these immediately in production!**

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://dwtip:...` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/dwtip` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT secret key | Change in production |
| `TOR_PROXY` | Tor SOCKS proxy | `socks5://localhost:9050` |
| `TELEGRAM_API_ID` | Telegram API ID | Required for Telegram |
| `TELEGRAM_API_HASH` | Telegram API Hash | Required for Telegram |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Threat Actors
- `GET /api/v1/threat-actors` - List threat actors
- `POST /api/v1/threat-actors` - Create threat actor
- `GET /api/v1/threat-actors/{id}` - Get threat actor

### Leaks
- `GET /api/v1/leaks` - List leaks
- `POST /api/v1/leaks` - Create leak
- `GET /api/v1/leaks/{id}` - Get leak

### IOCs
- `GET /api/v1/iocs` - List IOCs
- `POST /api/v1/iocs` - Create IOC
- `POST /api/v1/iocs/bulk` - Bulk create IOCs

### Sources
- `GET /api/v1/sources` - List data sources
- `POST /api/v1/sources` - Add data source

### Alerts
- `GET /api/v1/alerts` - List alerts
- `POST /api/v1/alerts` - Create alert
- `PUT /api/v1/alerts/{id}` - Update alert

## Adding New Sources

1. Create a new scraper class in `backend/scrapers/`
2. Register it in `backend/scrapers/registry.py`
3. Add source configuration via API or database

Example scraper configuration:
```python
{
    "name": "Custom Source",
    "type": "ransomware_blog",
    "url": "http://example.onion",
    "uses_tor": True,
    "scrape_interval_minutes": 30,
    "selectors": {
        "victim_card": ".victim-item",
        "victim_name": ".company-name",
        "date": ".publish-date"
    }
}
```

## WebSocket

Real-time updates via WebSocket:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('New update:', data);
};
```

## Security Considerations

- All dark web traffic is routed through Tor
- IP addresses are never logged
- Sensitive data is encrypted at rest
- JWT tokens for authentication
- Role-based access control

## License

MIT License - See LICENSE file for details.

## Disclaimer

This tool is for legitimate security research and threat intelligence purposes only. Users are responsible for ensuring compliance with applicable laws and regulations in their jurisdiction.
