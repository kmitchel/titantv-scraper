const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'titantv.db');
const db = new Database(dbPath);

console.log('Initialize database at ' + dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE, 
    channel_number TEXT,
    callsign TEXT,
    name TEXT,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER,
    title TEXT,
    sub_title TEXT,
    description TEXT,
    image_url TEXT,
    start_time INTEGER,
    end_time INTEGER,
    FOREIGN KEY(channel_id) REFERENCES channels(id),
    UNIQUE(channel_id, start_time)
  );

  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const insertChannelFn = db.prepare(`
    INSERT INTO channels (external_id, channel_number, callsign, name, logo_url)
    VALUES (@external_id, @channel_number, @callsign, @name, @logo_url)
    ON CONFLICT(external_id) DO UPDATE SET
        channel_number=excluded.channel_number,
        callsign=excluded.callsign,
        name=excluded.name,
        logo_url=excluded.logo_url
    RETURNING id
`);

const insertProgramFn = db.prepare(`
    INSERT INTO programs (channel_id, title, sub_title, description, image_url, start_time, end_time)
    VALUES (@channel_id, @title, @sub_title, @description, @image_url, @start_time, @end_time)
    ON CONFLICT(channel_id, start_time) DO UPDATE SET
        title=excluded.title,
        sub_title=excluded.sub_title,
        description=excluded.description,
        image_url=excluded.image_url,
        end_time=excluded.end_time
`);

const getChannelsFn = db.prepare('SELECT * FROM channels ORDER BY channel_number');
const getProgramsForChannelFn = db.prepare('SELECT * FROM programs WHERE channel_id = ? AND start_time >= ? AND start_time < ? ORDER BY start_time');
const getProgramFn = db.prepare('SELECT * FROM programs WHERE channel_id = ? AND start_time = ?');
const cleanupOldProgramsFn = db.prepare('DELETE FROM programs WHERE end_time < ?');
const getMetadataFn = db.prepare('SELECT value FROM metadata WHERE key = ?');
const setMetadataFn = db.prepare('INSERT INTO metadata (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=excluded.value');

module.exports = {
  db,
  saveChannel: (data) => insertChannelFn.get(data),
  saveProgram: (data) => insertProgramFn.run(data),
  getChannels: () => getChannelsFn.all(),
  getProgramsForChannel: (channelId, start, end) => getProgramsForChannelFn.all(channelId, start, end),
  getProgram: (channelId, startTime) => getProgramFn.get(channelId, startTime),
  cleanupOldPrograms: (timestamp) => cleanupOldProgramsFn.run(timestamp),
  getMetadata: (key) => getMetadataFn.get(key),
  setMetadata: (key, value) => setMetadataFn.run({ key, value })
};
