# Project Omni — GREENFIELD Strategy Artifact

**Mode:** GREENFIELD  
**Date:** 2026-03-02  
**State File:** `.antigravity/state.json`

---

## Executive Summary

Build a scalable, AI-native, event-driven, zero-trust application on top of the existing Capture Hub foundation. The existing Next.js 16 + Prisma + WebSocket stack serves as the runtime base. All new architecture follows Contracts-First, IaC, Zero-Trust, and AI-Core principles.

---

## Active Phases

### P1 — Contracts & Edge
| Area | Action |
|------|--------|
| **API Contracts** | Define typed GraphQL schema (or tRPC contracts) for all domain entities: CaptureItem, Project, Template, ItemLink, ConnectedDevice |
| **Event Contracts** | Define Avro/JSON Schema for domain events: `item.created`, `item.updated`, `project.changed`, `device.connected`, etc. |
| **Edge Gateway** | Unified API gateway layer (Next.js API routes + middleware) with rate limiting, auth validation, and request tracing |
| **Validation** | All contracts must compile and validate locally before any business logic proceeds |

**Gate:** Contracts compile. Edge gateway routes all defined endpoints successfully.

### P2 — Platform & Data
| Area | Action |
|------|--------|
| **IaC** | Dockerized infrastructure definitions; GitOps pipeline via GitHub Actions (existing `.github/workflows/`) |
| **Event Mesh** | Introduce lightweight event bus (in-process for MVP, Kafka-compatible interface for scale-out) |
| **Database** | Evaluate migration from SQLite → PostgreSQL (DistSQL-ready). Prisma schema remains source of truth |
| **Vector Store** | Add vector embedding storage for AI/RAG features (pgvector or dedicated service) |

**Gate:** IaC plan reviewed + human ack. Database read/write tests pass on new platform.

### P4 — AI & Logic
| Area | Action |
|------|--------|
| **LLM Gateway** | Configurable LLM routing layer (OpenAI, Anthropic, local models) with usage tracking |
| **RAG Pipeline** | Embed captured content → vector store → retrieval-augmented generation for smart search/summarization |
| **AI Agents** | Serverless agent orchestration for auto-tagging, content extraction, smart reminders |
| **Microservices** | Domain-bounded serverless functions for heavy processing (image analysis, NLP) |

**Gate:** Mock RAG query returns relevant results. Agent orchestration responds to test events.

### P5 — UX & Clients
| Area | Action |
|------|--------|
| **Zero-Trust Auth** | Migrate from next-auth session-based → Passkey/WebAuthn + JWT zero-trust model |
| **Client Hardening** | CSP headers, CORS lockdown, input sanitization across all endpoints |
| **Progressive UX** | Wasm-accelerated client features where applicable; offline-first capability via Service Worker |
| **Accessibility** | WCAG 2.1 AA compliance pass on all interactive components |

**Gate:** E2E simulation passes full zero-trust login flow (passkey registration + auth).

### P6 — Ops & Cleanup
| Area | Action |
|------|--------|
| **Observability** | OpenTelemetry tracing injected in all services; structured logging; health endpoints |
| **FinOps** | Resource utilization analysis; right-sizing recommendations for production |
| **Hardening** | Secrets scan, dependency audit, container image minimization |
| **Documentation** | Updated API docs, runbooks, architecture diagrams |

**Gate:** Traces visible in OTel collector. FinOps report generated. Human ack on final state.

---

## Architecture Principles

1. **Contracts First** — No business logic ships without compiled, validated API + event schemas
2. **Infrastructure as Code** — Every environment change is versioned, reviewed, and reproducible
3. **Zero Trust** — Every request authenticated and authorized at every boundary; no implicit trust
4. **AI Core** — AI/ML is a first-class citizen, not a bolt-on; LLM gateway + RAG are platform services
5. **Event-Driven** — State changes propagate via typed events; enables decoupled scaling
6. **Observable by Default** — OTel tracing in every service from day one

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| SQLite → PostgreSQL migration breaks existing data | Prisma migration tooling + automated backup before switch |
| Passkey browser support gaps | Fallback to TOTP/magic-link with progressive enhancement |
| LLM cost runaway | Gateway-level budget caps + model routing (cheap for simple, powerful for complex) |
| Event schema drift | Schema registry with compatibility checks on CI |

---

## Status

**Current Phase:** P1 (Contracts & Edge)  
**Status:** ⏳ AWAITING 'GO' from operator

