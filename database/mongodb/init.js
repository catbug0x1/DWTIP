db = db.getSiblingDB('dwtip');

db.raw_data.createIndex({ "hash": 1 }, { unique: true });
db.raw_data.createIndex({ "source_id": 1 });
db.raw_data.createIndex({ "collected_at": -1 });
db.raw_data.createIndex({ "content_type": 1 });
db.raw_data.createIndex({ "classification": 1 });

db.screenshots.createIndex({ "source_id": 1 });
db.screenshots.createIndex({ "created_at": -1 });

db.alerts_mongo.createIndex({ "created_at": -1 });
db.alerts_mongo.createIndex({ "read": 1 });
db.alerts_mongo.createIndex({ "user_id": 1 });

db.sessions.createIndex({ "created_at": 1 }, { expireAfterSeconds: 86400 });

db.feed_items.createIndex({ "created_at": -1 });
db.feed_items.createIndex({ "source_id": 1 });
db.feed_items.createIndex({ "content_hash": 1 }, { unique: true });

print('MongoDB indexes created successfully');
