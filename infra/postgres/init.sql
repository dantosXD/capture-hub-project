-- ==============================================================================
-- PostgreSQL Initialization Script (Project Omni P2)
-- Enables pgvector extension and creates baseline configuration
-- ==============================================================================

-- Enable pgvector for AI/RAG embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance configuration hints (applied via ALTER SYSTEM for persistence)
-- These are tuned for a 2-4GB RAM container; adjust for production
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET max_connections = 100;

-- WAL configuration for better write performance
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Logging configuration
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
ALTER SYSTEM SET log_line_prefix = '%t [%p] %u@%d ';
