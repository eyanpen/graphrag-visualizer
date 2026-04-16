"""
GraphRAG API Server
Loads configuration from config.yaml, supports multiple data sources
and dynamic switching via REST API.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
import yaml
import os
import sys
import logging
from pathlib import Path
from typing import Optional

# Logging: DEBUG to file, INFO to console
_log_dir = Path(__file__).parent / "logs"
_log_dir.mkdir(exist_ok=True)
_fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")

_file_handler = logging.FileHandler(_log_dir / "debug.log", mode="w", encoding="utf-8")
_file_handler.setLevel(logging.DEBUG)
_file_handler.setFormatter(_fmt)

_console_handler = logging.StreamHandler()
_console_handler.setLevel(logging.INFO)
_console_handler.setFormatter(_fmt)

# Root logger: captures all library logs (graphrag, litellm, etc.)
# Works because uvicorn.run(log_config=None) won't reset it
_root = logging.getLogger()
_root.setLevel(logging.DEBUG)
_root.addHandler(_file_handler)
_root.addHandler(_console_handler)

# App logger: for api.py own messages (inherits root handlers via propagate)
log = logging.getLogger("graphrag-api")

from utils import process_context_data

import graphrag.api as api
from graphrag.config.load_config import load_config
from graphrag.config.models.graph_rag_config import GraphRagConfig
import pandas as pd


def load_yaml_config() -> dict:
    """Load config.yaml from the parent directory (graphrag-visualizer root)."""
    config_path = Path(__file__).parent.parent / "config.yaml"
    if not config_path.exists():
        log.error("config.yaml not found at %s", config_path)
        sys.exit(1)
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def apply_model_config(graphrag_config: GraphRagConfig, yaml_config: dict) -> GraphRagConfig:
    """Override the LLM and embedding model settings from our yaml config."""
    models_cfg = yaml_config.get("models", {})
    api_base = models_cfg.get("api_base", "")
    chat_model = models_cfg.get("chat_model", "")
    embedding_model = models_cfg.get("embedding_model", "")

    if api_base:
        for cfg in graphrag_config.completion_models.values():
            cfg.api_base = api_base
            cfg.model_provider = "openai"
            if chat_model:
                cfg.model = chat_model
        for cfg in graphrag_config.embedding_models.values():
            cfg.api_base = api_base
            cfg.model_provider = "openai"
            cfg.call_args = {**cfg.call_args, "encoding_format": "float"}
            if embedding_model:
                cfg.model = embedding_model

    return graphrag_config


def load_data_source(source_path: str, yaml_config: dict):
    """Load parquet files and graphrag config for a given data source path."""
    output_path = Path(source_path)
    if not output_path.exists():
        raise FileNotFoundError(f"Data source path does not exist: {source_path}")

    # The project directory is the parent of the output directory
    project_path = output_path.parent

    # Try to load graphrag config from the project directory
    try:
        graphrag_config = load_config(project_path)
        graphrag_config = apply_model_config(graphrag_config, yaml_config)
    except Exception as e:
        log.warning("Could not load graphrag config from %s: %s", project_path, e)
        log.warning("Search functionality may not work for this data source.")
        graphrag_config = None

    # Load parquet files
    data = {}
    parquet_files = [
        "entities", "communities", "community_reports",
        "text_units", "relationships", "covariates", "documents"
    ]
    for name in parquet_files:
        file_path = output_path / f"{name}.parquet"
        if not file_path.exists():
            # Try with create_final_ prefix
            file_path = output_path / f"create_final_{name}.parquet"
        if file_path.exists():
            try:
                data[name] = pd.read_parquet(file_path)
            except Exception as e:
                log.warning("Could not load %s: %s", file_path, e)
                data[name] = None
        else:
            data[name] = None

    return graphrag_config, data


# Global state
yaml_config = load_yaml_config()
search_cfg = yaml_config.get("search", {})
COMMUNITY_LEVEL = search_cfg.get("community_level", 2)
RESPONSE_TYPE = search_cfg.get("response_type", "Single Paragraph")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the default (first) data source on startup."""
    data_sources = yaml_config.get("data_sources", [])
    if not data_sources:
        log.warning("No data sources configured in config.yaml")
        app.state.config = None
        app.state.data = {}
        app.state.current_source = None
    else:
        default_source = data_sources[0]
        try:
            config, data = load_data_source(default_source["path"], yaml_config)
            app.state.config = config
            app.state.data = data
            app.state.current_source = default_source["name"]
            log.info("Loaded default data source: %s", default_source['name'])
        except Exception as e:
            log.error("Failed loading default data source: %s", e)
            app.state.config = None
            app.state.data = {}
            app.state.current_source = None
    yield


app = FastAPI(lifespan=lifespan)

# CORS - allow the frontend
server_cfg = yaml_config.get("server", {})
frontend_port = server_cfg.get("frontend_port", 16888)
host = server_cfg.get("host", "0.0.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Data Source Management APIs
# ============================================================

@app.get("/api/datasources")
async def list_data_sources():
    """List all configured data sources."""
    data_sources = yaml_config.get("data_sources", [])
    result = []
    for ds in data_sources:
        result.append({
            "name": ds["name"],
            "path": ds["path"],
            "description": ds.get("description", ""),
            "active": ds["name"] == app.state.current_source,
        })
    return JSONResponse(content={"data_sources": result})


@app.post("/api/datasources/switch")
async def switch_data_source(name: str = Query(..., description="Data source name to switch to")):
    """Switch to a different data source."""
    data_sources = yaml_config.get("data_sources", [])
    target = None
    for ds in data_sources:
        if ds["name"] == name:
            target = ds
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"Data source '{name}' not found")

    try:
        config, data = load_data_source(target["path"], yaml_config)
        app.state.config = config
        app.state.data = data
        app.state.current_source = target["name"]
        return JSONResponse(content={
            "message": f"Switched to data source: {name}",
            "current_source": name,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load data source '{name}': {str(e)}")


@app.get("/api/datasources/current")
async def current_data_source():
    """Get the currently active data source."""
    return JSONResponse(content={"current_source": app.state.current_source})


# ============================================================
# Parquet File Serving APIs
# ============================================================

@app.get("/api/parquet/{filename}")
async def get_parquet_file(filename: str):
    """Serve a parquet file from the current data source."""
    data_sources = yaml_config.get("data_sources", [])
    current = None
    for ds in data_sources:
        if ds["name"] == app.state.current_source:
            current = ds
            break

    if not current:
        raise HTTPException(status_code=404, detail="No active data source")

    output_path = Path(current["path"])

    # Try exact filename
    file_path = output_path / filename
    if not file_path.exists():
        # Try with create_final_ prefix
        file_path = output_path / f"create_final_{filename}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")

    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename=filename,
    )


@app.get("/api/parquet")
async def list_parquet_files():
    """List available parquet files in the current data source."""
    data_sources = yaml_config.get("data_sources", [])
    current = None
    for ds in data_sources:
        if ds["name"] == app.state.current_source:
            current = ds
            break

    if not current:
        raise HTTPException(status_code=404, detail="No active data source")

    output_path = Path(current["path"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Data source path does not exist")

    files = []
    for f in output_path.glob("*.parquet"):
        files.append(f.name)

    return JSONResponse(content={"files": sorted(files)})


# ============================================================
# Search APIs
# ============================================================

@app.get("/search/global")
async def global_search(query: str = Query(..., description="Global Search")):
    if not app.state.config:
        raise HTTPException(status_code=503, detail="No graphrag config loaded. Search is unavailable.")
    data = app.state.data
    if not data.get("entities") is not None:
        raise HTTPException(status_code=503, detail="Required data not loaded for global search.")
    try:
        response, context = await api.global_search(
            config=app.state.config,
            entities=data["entities"],
            communities=data["communities"],
            community_reports=data["community_reports"],
            community_level=COMMUNITY_LEVEL,
            dynamic_community_selection=False,
            response_type=RESPONSE_TYPE,
            query=query,
        )
        response_dict = {
            "response": response,
            "context_data": process_context_data(context),
        }
        return JSONResponse(content=response_dict)
    except Exception as e:
        log.exception("global_search failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/local")
async def local_search(query: str = Query(..., description="Local Search")):
    if not app.state.config:
        raise HTTPException(status_code=503, detail="No graphrag config loaded. Search is unavailable.")
    data = app.state.data
    try:
        response, context = await api.local_search(
            config=app.state.config,
            entities=data["entities"],
            communities=data["communities"],
            community_reports=data["community_reports"],
            text_units=data["text_units"],
            relationships=data["relationships"],
            covariates=data.get("covariates"),
            community_level=COMMUNITY_LEVEL,
            response_type=RESPONSE_TYPE,
            query=query,
        )
        response_dict = {
            "response": response,
            "context_data": process_context_data(context),
        }
        return JSONResponse(content=response_dict)
    except Exception as e:
        log.exception("local_search failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/drift")
async def drift_search(query: str = Query(..., description="DRIFT Search")):
    if not app.state.config:
        raise HTTPException(status_code=503, detail="No graphrag config loaded. Search is unavailable.")
    data = app.state.data
    try:
        response, context = await api.drift_search(
            config=app.state.config,
            entities=data["entities"],
            communities=data["communities"],
            community_reports=data["community_reports"],
            text_units=data["text_units"],
            relationships=data["relationships"],
            community_level=COMMUNITY_LEVEL,
            response_type=RESPONSE_TYPE,
            query=query,
        )
        response_dict = {
            "response": response,
            "context_data": process_context_data(context),
        }
        return JSONResponse(content=response_dict)
    except Exception as e:
        log.exception("drift_search failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/basic")
async def basic_search(query: str = Query(..., description="Basic Search")):
    if not app.state.config:
        raise HTTPException(status_code=503, detail="No graphrag config loaded. Search is unavailable.")
    data = app.state.data
    try:
        response, context = await api.basic_search(
            config=app.state.config,
            text_units=data["text_units"],
            response_type=RESPONSE_TYPE,
            query=query,
        )
        response_dict = {
            "response": response,
            "context_data": process_context_data(context),
        }
        return JSONResponse(content=response_dict)
    except Exception as e:
        log.exception("basic_search failed")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Status & Config APIs
# ============================================================

@app.get("/status")
async def status():
    return JSONResponse(content={
        "status": "Server is up and running",
        "current_source": app.state.current_source,
    })


@app.get("/api/config")
async def get_config():
    """Return non-sensitive configuration info for the frontend."""
    server = yaml_config.get("server", {})
    models = yaml_config.get("models", {})
    return JSONResponse(content={
        "host": server.get("host", "0.0.0.0"),
        "api_port": server.get("api_port", 16889),
        "frontend_port": server.get("frontend_port", 16888),
        "chat_model": models.get("chat_model", ""),
        "embedding_model": models.get("embedding_model", ""),
    })


if __name__ == "__main__":
    api_port = yaml_config.get("server", {}).get("api_port", 16889)
    api_host = yaml_config.get("server", {}).get("host", "0.0.0.0")
    log.info("Starting GraphRAG API on %s:%s", api_host, api_port)
    uvicorn.run(app, host=api_host, port=api_port, log_config=None)
