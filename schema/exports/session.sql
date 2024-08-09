
CREATE TABLE sessions(
    id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    sid TEXT UNIQUE NOT NULL ,
    expired INTEGER DEFAULT 0 NOT NULL ,
    sess TEXT
);
CREATE TRIGGER sessions_updated_at AFTER UPDATE ON sessions WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;
CREATE UNIQUE INDEX idx_sessions_sid ON sessions (sid);
