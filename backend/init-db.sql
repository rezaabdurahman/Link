-- Initialize database and user
CREATE USER linkuser WITH SUPERUSER PASSWORD 'linkpass';
CREATE DATABASE linkdb OWNER linkuser;
GRANT ALL PRIVILEGES ON DATABASE linkdb TO linkuser;

-- Enable required extensions  
\c linkdb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
