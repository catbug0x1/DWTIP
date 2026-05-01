CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS threat_actors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    aliases JSON DEFAULT '[]',
    description TEXT,
    motivation VARCHAR(100),
    sophistication VARCHAR(50),
    resource_level VARCHAR(50),
    primary_languages JSON DEFAULT '[]',
    target_industries JSON DEFAULT '[]',
    target_regions JSON DEFAULT '[]',
    ttps JSON DEFAULT '[]',
    associated_malware JSON DEFAULT '[]',
    associated_tools JSON DEFAULT '[]',
    associated_ransomware JSON DEFAULT '[]',
    attribution_score FLOAT DEFAULT 0.0,
    threat_score FLOAT DEFAULT 0.0,
    risk_level VARCHAR(20) DEFAULT 'low',
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contact_info JSON DEFAULT '{}',
    infrastructure_ips JSON DEFAULT '[]',
    infrastructure_domains JSON DEFAULT '[]',
    wallet_addresses JSON DEFAULT '[]',
    tags JSON DEFAULT '[]',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_threat_actor_name ON threat_actors(name);
CREATE INDEX idx_threat_actor_risk ON threat_actors(risk_level);
CREATE INDEX idx_threat_actor_active ON threat_actors(is_active);

CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    url VARCHAR(1000),
    onion_url VARCHAR(1000),
    description TEXT,
    language VARCHAR(10) DEFAULT 'en',
    requires_auth BOOLEAN DEFAULT FALSE,
    auth_type VARCHAR(50),
    credentials JSON,
    is_active BOOLEAN DEFAULT TRUE,
    is_onion BOOLEAN DEFAULT FALSE,
    uses_tor BOOLEAN DEFAULT FALSE,
    scrape_interval_minutes INTEGER DEFAULT 60,
    last_scraped TIMESTAMP,
    last_success TIMESTAMP,
    scrape_failure_count INTEGER DEFAULT 0,
    scraping_config JSON DEFAULT '{}',
    selectors JSON DEFAULT '{}',
    reliability_score FLOAT DEFAULT 0.5,
    tags JSON DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_source_name ON sources(name);
CREATE INDEX idx_source_type ON sources(type);
CREATE INDEX idx_source_active ON sources(is_active);

CREATE TABLE IF NOT EXISTS leaks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    victim_name VARCHAR(255),
    victim_industry VARCHAR(100),
    victim_country VARCHAR(100),
    victim_website VARCHAR(500),
    victim_size VARCHAR(50),
    actor_id INTEGER REFERENCES threat_actors(id),
    actor_name VARCHAR(255),
    source_id INTEGER REFERENCES sources(id),
    source_url VARCHAR(1000),
    status VARCHAR(20) DEFAULT 'new',
    severity VARCHAR(20) DEFAULT 'medium',
    confidence FLOAT DEFAULT 0.5,
    data_types JSON DEFAULT '[]',
    data_size VARCHAR(100),
    record_count INTEGER,
    published_date TIMESTAMP,
    deadline_date TIMESTAMP,
    asking_price VARCHAR(100),
    currency VARCHAR(20),
    tags JSON DEFAULT '[]',
    extracted_iocs JSON DEFAULT '[]',
    screenshot_url VARCHAR(1000),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leak_victim ON leaks(victim_name);
CREATE INDEX idx_leak_actor ON leaks(actor_id);
CREATE INDEX idx_leak_severity ON leaks(severity);
CREATE INDEX idx_leak_status ON leaks(status);
CREATE INDEX idx_leak_created ON leaks(created_at DESC);

CREATE TABLE IF NOT EXISTS iocs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    value TEXT UNIQUE NOT NULL,
    actor_id INTEGER REFERENCES threat_actors(id),
    leak_id INTEGER REFERENCES leaks(id),
    source_id INTEGER REFERENCES sources(id),
    context TEXT,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    threat_score FLOAT DEFAULT 0.0,
    false_positive_rate FLOAT DEFAULT 0.0,
    tags JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    is_whitelisted BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ioc_type ON iocs(type);
CREATE INDEX idx_ioc_value ON iocs(value);
CREATE INDEX idx_ioc_active ON iocs(is_active);
CREATE INDEX idx_ioc_threat_score ON iocs(threat_score);

CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES sources(id),
    actor_id INTEGER REFERENCES threat_actors(id),
    external_id VARCHAR(255),
    title VARCHAR(500),
    content TEXT,
    content_hash VARCHAR(64) UNIQUE,
    author_username VARCHAR(255),
    author_id VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    sentiment VARCHAR(20),
    post_type VARCHAR(50),
    category VARCHAR(100),
    upvotes INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    extracted_iocs JSON DEFAULT '[]',
    extracted_entities JSON DEFAULT '{}',
    keywords JSON DEFAULT '[]',
    is_verified BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_hash ON posts(content_hash);
CREATE INDEX idx_post_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    alert_keywords JSON DEFAULT '[]',
    alert_sources JSON DEFAULT '[]',
    alert_iocs JSON DEFAULT '[]',
    notification_preferences JSON DEFAULT '{}',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_username ON users(username);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    source_id INTEGER REFERENCES sources(id),
    source_name VARCHAR(255),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    entity_value VARCHAR(500),
    severity VARCHAR(20) DEFAULT 'medium',
    confidence FLOAT DEFAULT 0.5,
    matched_keywords JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_alert_user ON alerts(user_id);
CREATE INDEX idx_alert_read ON alerts(is_read);
CREATE INDEX idx_alert_created ON alerts(created_at DESC);
