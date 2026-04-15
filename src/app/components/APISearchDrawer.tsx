import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  TextField,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { SearchResult } from "../models/search-result";

type SearchType = "local" | "global" | "drift" | "basic";

interface APISearchDrawerProps {
  apiDrawerOpen: boolean;
  toggleDrawer: (open: boolean) => () => void;
  handleApiSearch: (
    query: string,
    searchType: SearchType
  ) => Promise<void>;
  apiSearchResults: SearchResult | null;
  localSearchEnabled: boolean;
  globalSearchEnabled: boolean;
  hasCovariates: boolean;
  serverUp: boolean;
}

const APISearchDrawer: React.FC<APISearchDrawerProps> = ({
  apiDrawerOpen,
  toggleDrawer,
  handleApiSearch,
  apiSearchResults,
  localSearchEnabled,
  globalSearchEnabled,
  hasCovariates,
  serverUp,
}) => {
  const [query, setQuery] = useState<string>("");
  const [loadingType, setLoadingType] = useState<SearchType | null>(null);
  const [expandedTables, setExpandedTables] = useState<{
    [key: string]: boolean;
  }>({});

  useEffect(() => {
    if (apiSearchResults && apiSearchResults.context_data) {
      const initialExpandedState: { [key: string]: boolean } = {};
      if (typeof apiSearchResults.context_data === "object" && !Array.isArray(apiSearchResults.context_data)) {
        Object.keys(apiSearchResults.context_data).forEach((key) => {
          initialExpandedState[key] = true;
        });
      }
      setExpandedTables(initialExpandedState);
    }
  }, [apiSearchResults]);

  const handleSearch = async (searchType: SearchType) => {
    setLoadingType(searchType);
    try {
      await handleApiSearch(query, searchType);
    } finally {
      setLoadingType(null);
    }
  };

  const toggleTable = (key: string) => {
    setExpandedTables((prevState) => ({
      ...prevState,
      [key]: !prevState[key],
    }));
  };

  const isLoading = loadingType !== null;

  return (
    <Drawer
      anchor="left"
      open={apiDrawerOpen}
      onClose={toggleDrawer(false)}
      sx={{ zIndex: 1500 }}
    >
      <Box
        sx={{ width: "60vw", padding: 2, paddingTop: 6, position: "relative" }}
      >
        <IconButton
          onClick={toggleDrawer(false)}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && !isLoading && localSearchEnabled) {
                await handleSearch("local");
              }
            }}
            placeholder="Enter search query"
            fullWidth
            margin="normal"
          />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              sx={{ flex: 1, minWidth: 120, whiteSpace: "normal", textAlign: "center" }}
              onClick={() => handleSearch("local")}
              disabled={!serverUp || !localSearchEnabled || isLoading}
            >
              {loadingType === "local" ? <CircularProgress size={24} /> : "Local Search"}
            </Button>
            <Button
              variant="contained"
              color="success"
              sx={{ flex: 1, minWidth: 120, whiteSpace: "normal", textAlign: "center" }}
              onClick={() => handleSearch("global")}
              disabled={!serverUp || !globalSearchEnabled || isLoading}
            >
              {loadingType === "global" ? <CircularProgress size={24} /> : "Global Search"}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              sx={{ flex: 1, minWidth: 120, whiteSpace: "normal", textAlign: "center" }}
              onClick={() => handleSearch("drift")}
              disabled={!serverUp || isLoading}
            >
              {loadingType === "drift" ? <CircularProgress size={24} /> : "DRIFT Search"}
            </Button>
            <Button
              variant="contained"
              color="info"
              sx={{ flex: 1, minWidth: 120, whiteSpace: "normal", textAlign: "center" }}
              onClick={() => handleSearch("basic")}
              disabled={!serverUp || isLoading}
            >
              {loadingType === "basic" ? <CircularProgress size={24} /> : "Basic Search"}
            </Button>
          </Box>

          {!serverUp && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Server is not running. Please start the server using{" "}
              <code>./start.sh</code>.
            </Alert>
          )}
          {!localSearchEnabled && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Please enable "Include Text Unit" and "Include Communities"
              {hasCovariates && ', and "Include Covariates"'} to use Local
              Search.
            </Alert>
          )}
          {!globalSearchEnabled && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Please enable "Include Communities" to use Global Search.
            </Alert>
          )}
        </Box>

        {apiSearchResults && (
          <>
            <Card sx={{ marginTop: 2 }}>
              <CardHeader title="Search Results" />
              <CardContent>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {apiSearchResults.response}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ marginTop: 2 }}>
              <CardHeader title="Metadata" />
              <CardContent>
                {apiSearchResults.completion_time !== undefined && (
                  <Typography variant="body2">
                    <strong>Completion Time:</strong>{" "}
                    {apiSearchResults.completion_time} ms
                  </Typography>
                )}
                {apiSearchResults.llm_calls !== undefined && (
                  <Typography variant="body2">
                    <strong>LLM Calls:</strong> {apiSearchResults.llm_calls}
                  </Typography>
                )}
                {apiSearchResults.prompt_tokens !== undefined && (
                  <Typography variant="body2">
                    <strong>Prompt Tokens:</strong>{" "}
                    {apiSearchResults.prompt_tokens}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {apiSearchResults.context_data &&
              typeof apiSearchResults.context_data === "object" &&
              !Array.isArray(apiSearchResults.context_data) &&
              Object.entries(apiSearchResults.context_data).map(
                ([key, data], index) => (
                  <Card sx={{ marginTop: 2 }} key={index}>
                    <CardHeader
                      title={key.charAt(0).toUpperCase() + key.slice(1)}
                      action={
                        <IconButton onClick={() => toggleTable(key)}>
                          {expandedTables[key] ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      }
                    />
                    <Collapse
                      in={expandedTables[key]}
                      timeout="auto"
                      unmountOnExit
                    >
                      <CardContent>
                        {Array.isArray(data) && data.length > 0 ? (
                          <TableContainer component={Paper}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  {Object.keys(data[0]).map(
                                    (columnName, idx) => (
                                      <TableCell key={idx}>
                                        {columnName.charAt(0).toUpperCase() +
                                          columnName.slice(1)}
                                      </TableCell>
                                    )
                                  )}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {data.map((row: any, rowIndex: number) => (
                                  <TableRow key={rowIndex}>
                                    {Object.values(row).map(
                                      (value: any, cellIndex: number) => (
                                        <TableCell key={cellIndex}>
                                          {typeof value === "string"
                                            ? value
                                            : JSON.stringify(value, null, 2)}
                                        </TableCell>
                                      )
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            No data available
                          </Typography>
                        )}
                      </CardContent>
                    </Collapse>
                  </Card>
                )
              )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default APISearchDrawer;
