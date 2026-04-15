# GraphRAG Visualizer - Usage Guide

## Quick Start

```bash
# 1. Edit config.yaml to configure your data sources and models
vim config.yaml

# 2. Install Python dependencies for the API
pip install -r graphrag-api/requirements.txt

# 3. Start both API and frontend
./start.sh
```

The visualizer will be available at `http://localhost:16888` and the API at `http://localhost:16889`.

## Configuration (config.yaml)

All configuration is in `config.yaml`:

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
  - name: "another-dataset"
    path: "/path/to/another/output/"
    description: "Another Dataset"
```

### Adding Data Sources

Add entries under `data_sources` in `config.yaml`. Each entry needs:
- `name`: A unique identifier for the data source
- `path`: Absolute path to the GraphRAG output directory containing parquet files
- `description`: (optional) Human-readable description

### Model Configuration

The `models` section configures the LLM and embedding models used for search:
- `api_base`: OpenAI-compatible API endpoint
- `chat_model`: Model for search queries (e.g., Qwen3-Coder)
- `embedding_model`: Model for embeddings (e.g., Qwen3-Embedding)

## Startup Options

```bash
# Start both API and frontend
./start.sh

# Start only the API server
./start.sh --api-only

# Start only the frontend (API must be running separately)
./start.sh --frontend-only
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
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
            ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
            │ Data Source 1│ │ Data Source 2│  │ Data Source N│
            │ (parquet)    │ │ (parquet)    │  │ (parquet)    │
            └──────────────┘ └──────────────┘  └──────────────┘
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

## Workflow

1. Start the application with `./start.sh`
2. Open the browser at `http://localhost:16888`
3. On the "Data Source" tab, select a data source from the dropdown
4. The parquet data loads automatically and you can switch to "Graph Visualization" or "Data Tables"
5. Use the "Ask Query" button in the graph view to perform Local/Global/DRIFT/Basic search
6. Search operates on the currently selected data source
