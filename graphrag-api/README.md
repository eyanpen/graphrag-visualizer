# GraphRAG API [![GraphRAG v2.2.0](https://img.shields.io/badge/GraphRAG-v2.2.0-blue?style=flat-square)](https://pypi.org/project/graphrag/2.2.0/)

A FastAPI-based server that provides Global, Local, DRIFT, and Basic search capabilities based on [Microsoft GraphRAG](https://github.com/microsoft/graphrag). Supports multiple data sources with runtime switching, configured via a shared `config.yaml`.

Originally created by [Yan-Ying Liao](https://github.com/noworneverev/graphrag-api). This version has been rewritten to support multi-datasource management and unified configuration.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

This API is designed to run as part of the GraphRAG Visualizer. Configuration is read from `../config.yaml` (the parent directory).

```bash
# Recommended: use the start script from the parent directory
cd ..
./start.sh --api-only

# Or run directly
python api.py
```

The API starts on the port specified in `config.yaml` (default: `16889`). Open `http://localhost:16889/docs` for the interactive API documentation.

## API Endpoints

### Data Source Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/datasources` | GET | List all configured data sources |
| `/api/datasources/switch?name=xxx` | POST | Switch active data source |
| `/api/datasources/current` | GET | Get current active data source |

### Parquet File Serving

| Endpoint | Method | Description |
|---|---|---|
| `/api/parquet` | GET | List parquet files in active source |
| `/api/parquet/{filename}` | GET | Download a parquet file |

### Search

| Endpoint | Method | Description |
|---|---|---|
| `/search/local?query=xxx` | GET | Local search |
| `/search/global?query=xxx` | GET | Global search |
| `/search/drift?query=xxx` | GET | DRIFT search |
| `/search/basic?query=xxx` | GET | Basic search |

### Status & Config

| Endpoint | Method | Description |
|---|---|---|
| `/status` | GET | Server health check |
| `/api/config` | GET | Get server configuration |

## Configuration

All configuration is in `../config.yaml`. See the parent [README](../README.md) for details.

## License

MIT License. See [LICENSE](LICENSE).
