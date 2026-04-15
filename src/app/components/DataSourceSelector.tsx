import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import agent, { DataSourceInfo } from "../api/agent";

interface DataSourceSelectorProps {
  onDataSourceChanged: () => void;
  serverUp: boolean;
}

const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  onDataSourceChanged,
  serverUp,
}) => {
  const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serverUp) {
      loadDataSources();
    }
  }, [serverUp]);

  const loadDataSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await agent.DataSources.list();
      setDataSources(result.data_sources);
      const active = result.data_sources.find((ds) => ds.active);
      if (active) {
        setSelectedSource(active.name);
      }
    } catch (err) {
      setError("Failed to load data sources from server.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async () => {
    if (!selectedSource) return;
    setSwitching(true);
    setError(null);
    try {
      await agent.DataSources.switch(selectedSource);
      await loadDataSources();
      onDataSourceChanged();
    } catch (err: any) {
      setError(
        err?.data?.detail || "Failed to switch data source."
      );
      console.error(err);
    } finally {
      setSwitching(false);
    }
  };

  const activeSource = dataSources.find((ds) => ds.active);
  const isAlreadyActive = activeSource?.name === selectedSource;

  if (!serverUp) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        GraphRAG API server is not running. Please start the server first.
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <StorageIcon color="primary" />
        <Typography variant="h6">Data Source</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {activeSource && (
            <Box sx={{ mb: 2 }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`Active: ${activeSource.name}`}
                color="success"
                variant="outlined"
                sx={{ mr: 1 }}
              />
              {activeSource.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {activeSource.description}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Path: {activeSource.path}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            <FormControl fullWidth>
              <InputLabel id="datasource-select-label">Select Data Source</InputLabel>
              <Select
                labelId="datasource-select-label"
                value={selectedSource}
                label="Select Data Source"
                onChange={(e) => setSelectedSource(e.target.value)}
                disabled={switching}
              >
                {dataSources.map((ds) => (
                  <MenuItem key={ds.name} value={ds.name}>
                    <Box>
                      <Typography variant="body1">
                        {ds.name}
                        {ds.active && (
                          <Chip
                            label="active"
                            size="small"
                            color="success"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                      {ds.description && (
                        <Typography variant="caption" color="text.secondary">
                          {ds.description}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleSwitch}
              disabled={switching || !selectedSource || isAlreadyActive}
              sx={{ minWidth: 120, height: 56 }}
            >
              {switching ? <CircularProgress size={24} /> : "Load"}
            </Button>
          </Box>

          {isAlreadyActive && selectedSource && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              This data source is already active. Select a different one or the data is already loaded.
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

export default DataSourceSelector;
