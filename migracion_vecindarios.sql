USE entremanos;

CREATE TABLE IF NOT EXISTS neighborhoods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY neighborhoods_name_unique (name)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO neighborhoods (name) VALUES ('Villa del Parque');

ALTER TABLE users
  ADD COLUMN neighborhood_id INT UNSIGNED NULL AFTER password_hash;

UPDATE users
SET neighborhood_id = (SELECT id FROM neighborhoods WHERE name = 'Villa del Parque')
WHERE neighborhood_id IS NULL;

ALTER TABLE users
  MODIFY COLUMN neighborhood_id INT UNSIGNED NOT NULL,
  ADD KEY users_neighborhood_id_index (neighborhood_id),
  ADD CONSTRAINT users_neighborhood_fk
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
