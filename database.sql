CREATE DATABASE IF NOT EXISTS entremanos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE entremanos;

CREATE TABLE IF NOT EXISTS vecindarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY vecindarios_nombre_unico (nombre)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO vecindarios (nombre) VALUES ('Villa del Parque');

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(32) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  contrasena_cifrada VARCHAR(255) NOT NULL,
  vecindario_id INT UNSIGNED NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY usuarios_correo_unico (correo),
  KEY usuarios_vecindario_id_indice (vecindario_id),
  CONSTRAINT usuarios_vecindario_fk
    FOREIGN KEY (vecindario_id) REFERENCES vecindarios (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
