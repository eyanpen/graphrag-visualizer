# GraphRAG Visualizer

![demo](public/demo.png)

## Overview

GraphRAG Visualizer is a web application for visualizing and searching [Microsoft GraphRAG](https://github.com/microsoft/graphrag) artifacts. It provides graph visualization, data tables, and integrated search (Local, Global, DRIFT, Basic) — all driven by a unified `config.yaml`.

Originally created by [Yan-Ying Liao](https://github.com/noworneverev/graphrag-visualizer). This fork adds multi-datasource support, a unified configuration system, and a custom FastAPI backend.

## Features

- **Graph Visualization**: 2D / 3D interactive graph view.
- **Data Tables**: Browse parquet data in tabular form.
- **Integrated Search**: Local, Global, DRIFT, and Basic search via the built-in API server.
- **Multi-Datasource**: Configure multiple GraphRAG output directories in `config.yaml` and switch between them at runtime.
- **Unified Configuration**: Single `config.yaml` for server ports, model endpoints, search parameters, and data sources — no `.env` files needed.
- **Local Processing**: All data stays on your machine.

## Quick Start

```bash
# 1. Edit config.yaml
vim config.yaml

# 2. Install Python dependencies for the API
pip install -r graphrag-api/requirements.txt

# 3. Install frontend dependencies
npm install

# 4. Start both API and frontend
./start.sh
```

- Frontend: `http://localhost:16888`
- API: `http://localhost:16889`

## Configuration (config.yaml)

```yaml
server:
  host: "0.0.0.0"
  frontend_port: 16888
  api_port: 16889

models:
  embedding_model: "Qwen/Qwen3-Embedding-8B-Alt"
  chat_model: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8"
  api_base: "http://10.210.156.69:8633"

search:
  community_level: 2
  response_type: "Single Paragraph"

data_sources:
  - name: "graphrag-example"
    path: "/path/to/graphrag/output/"
    description: "My GraphRAG Dataset"
```

### Data Sources

Add entries under `data_sources`. Each entry needs:
- `name`: Unique identifier
- `path`: Absolute path to the GraphRAG output directory (containing parquet files)
- `description`: (optional) Human-readable label

The first entry is loaded by default on startup. Switch between sources via the UI or the `/api/datasources/switch` endpoint.

### Model Configuration

The `models` section configures the LLM and embedding models used for search:
- `api_base`: OpenAI-compatible API endpoint
- `chat_model`: Model for search queries
- `embedding_model`: Model for embeddings

## Startup & Shutdown

```bash
./start.sh                  # Start both API and frontend (foreground)
./start.sh --daemon         # Start in background
./start.sh --api-only       # Start only the API server
./start.sh --frontend-only  # Start only the frontend

./stop.sh                   # Stop all services
./stop.sh --api-only        # Stop only the API
./stop.sh --frontend-only   # Stop only the frontend
```

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  React Frontend     │────▶│  GraphRAG API         │
│  (port 16888)       │     │  (port 16889)         │
│                     │     │                       │
│  - Data Source      │     │  - /api/datasources   │
│    Selector         │     │  - /api/parquet/*     │
│  - Graph Viewer     │     │  - /search/local      │
│  - Data Tables      │     │  - /search/global     │
│  - Search UI        │     │  - /search/drift      │
│                     │     │  - /search/basic      │
└─────────────────────┘     └──────────────────────┘
                                      │
                              ┌───────┴───────┐
                              │  config.yaml  │
                              │  (shared)     │
                              └───────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/datasources` | GET | List all configured data sources |
| `/api/datasources/switch?name=xxx` | POST | Switch active data source |
| `/api/datasources/current` | GET | Get current active data source |
| `/api/parquet` | GET | List parquet files in active source |
| `/api/parquet/{filename}` | GET | Download a parquet file |
| `/search/local?query=xxx` | GET | Local search |
| `/search/global?query=xxx` | GET | Global search |
| `/search/drift?query=xxx` | GET | DRIFT search |
| `/search/basic?query=xxx` | GET | Basic search |
| `/status` | GET | Server health check |
| `/api/config` | GET | Get server configuration |

## Helper Scripts

### load_output.sh

Creates a symlink from `public/artifacts` to a GraphRAG output directory for development mode auto-loading:

```bash
./load_output.sh /path/to/graphrag/output
```

## Graph Data Model

Derived from the [GraphRAG Neo4j Cypher notebook](https://github.com/microsoft/graphrag/blob/main/examples_notebooks/community_contrib/neo4j/graphrag_import_neo4j_cypher.ipynb).

### Nodes

| Node | Type |
|---|---|
| Document | `RAW_DOCUMENT` |
| Text Unit | `CHUNK` |
| Community | `COMMUNITY` |
| Finding | `FINDING` |
| Covariate | `COVARIATE` |
| Entity | _Varies_ |

### Relationships

| Source | Relationship | Target |
|---|---|---|
| Entity | `RELATED` | Entity |
| Text Unit | `PART_OF` | Document |
| Text Unit | `HAS_ENTITY` | Entity |
| Text Unit | `HAS_COVARIATE` | Covariate |
| Community | `HAS_FINDING` | Finding |
| Entity | `IN_COMMUNITY` | Community |

## Supported Parquet File Formats

- **GraphRAG v2.x.x**: `entities.parquet`, `relationships.parquet`, `documents.parquet`, `text_units.parquet`, `communities.parquet`, `community_reports.parquet`, `covariates.parquet`
- **GraphRAG v1.x.x**: Same names with `create_final_` prefix

## License

MIT License. See [LICENSE](LICENSE).

Original project by [Yan-Ying Liao](https://github.com/noworneverev/graphrag-visualizer).
