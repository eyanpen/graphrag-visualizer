import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GraphViewer from "./GraphViewer";
import { Box, Container, Tab, Tabs, CircularProgress, Typography } from "@mui/material";
import DataSourceSelector from "./DataSourceSelector";
import Introduction from "./Introduction";
import useFileHandler from "../hooks/useFileHandler";
import useGraphData from "../hooks/useGraphData";
import DataTableContainer from "./DataTableContainer";
import Statistics from "./Statistics";
import CommunityExplorer from "./CommunityExplorer";
import ReactGA from "react-ga4";
import agent from "../api/agent";

const GraphDataHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [tabIndex, setTabIndex] = useState(0);
  const [graphType, setGraphType] = useState<"2d" | "3d">("2d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<
    | "entities"
    | "relationships"
    | "documents"
    | "textunits"
    | "communities"
    | "communityReports"
    | "covariates"
  >("entities");
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [includeTextUnits, setIncludeTextUnits] = useState(false);
  const [includeCommunities, setIncludeCommunities] = useState(false);
  const [includeCovariates, setIncludeCovariates] = useState(false);
  const [maxEntities, setMaxEntities] = useState(500);
  const [serverUp, setServerUp] = useState(false);

  const {
    entities,
    relationships,
    documents,
    textunits,
    communities,
    covariates,
    communityReports,
    loadFromApi,
    loading,
  } = useFileHandler();

  const graphData = useGraphData(
    entities,
    relationships,
    documents,
    textunits,
    communities,
    communityReports,
    covariates,
    includeDocuments,
    includeTextUnits,
    includeCommunities,
    includeCovariates,
    maxEntities
  );

  const hasDocuments = documents.length > 0;
  const hasTextUnits = textunits.length > 0;
  const hasCommunities = communities.length > 0;
  const hasCovariates = covariates.length > 0;

  // Check server status on mount, with retry
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const poll = async (attempt: number) => {
      if (cancelled) return;
      const up = await checkServerStatus();
      if (!up && !cancelled) {
        // Retry with back-off: 2s, 3s, 4s, 5s, then every 5s
        const delay = Math.min(2000 + attempt * 1000, 5000);
        console.log(`[GraphRAG] API not ready, retrying in ${delay}ms (attempt ${attempt + 1})...`);
        retryTimer = setTimeout(() => poll(attempt + 1), delay);
      }
    };

    poll(0);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, []);

  // Auto-load data from API when server is up
  useEffect(() => {
    if (serverUp) {
      loadFromApi();
    }
    // eslint-disable-next-line
  }, [serverUp]);

  useEffect(() => {
    const measurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
    if (measurementId) {
      ReactGA.initialize(measurementId);
    } else {
      // Not an error in dev mode
    }
  }, []);

  useEffect(() => {
    switch (location.pathname) {
      case "/upload":
        setTabIndex(0);
        break;
      case "/graph":
        setTabIndex(1);
        break;
      case "/data":
        setTabIndex(2);
        break;
      case "/statistics":
        setTabIndex(3);
        break;
      case "/communities":
        setTabIndex(4);
        break;
      default:
        setTabIndex(0);
    }
  }, [location.pathname]);

  const checkServerStatus = async (): Promise<boolean> => {
    try {
      const response = await agent.Status.check();
      if (response.status === "Server is up and running") {
        setServerUp(true);
        return true;
      }
      setServerUp(false);
      return false;
    } catch (error) {
      setServerUp(false);
      return false;
    }
  };

  const handleDataSourceChanged = () => {
    // Reload parquet data from the newly selected data source
    loadFromApi();
  };

  const handleChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabIndex(newValue);
    let path = "/upload";
    if (newValue === 1) path = "/graph";
    if (newValue === 2) path = "/data";
    if (newValue === 3) path = "/statistics";
    if (newValue === 4) path = "/communities";
    navigate(path);
    ReactGA.send({
      hitType: "event",
      eventCategory: "Tabs",
      eventAction: "click",
      eventLabel: `Tab ${newValue}`,
    });
  };

  const toggleGraphType = () => {
    setGraphType((prevType) => (prevType === "2d" ? "3d" : "2d"));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      <Tabs value={tabIndex} onChange={handleChange} centered>
        <Tab label="Data Source" />
        <Tab label="Graph Visualization" />
        <Tab label="Data Tables" />
        <Tab label="Statistics" />
        <Tab label="Community Explorer" />
      </Tabs>
      {tabIndex === 0 && (
        <Container
          maxWidth="md"
          sx={{
            mt: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DataSourceSelector
            onDataSourceChanged={handleDataSourceChanged}
            serverUp={serverUp}
          />
          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading parquet data from server...</Typography>
            </Box>
          )}
          <Introduction />
        </Container>
      )}
      {tabIndex === 1 && (
        <Box
          p={3}
          sx={{
            height: isFullscreen ? "100vh" : "calc(100vh - 64px)",
            width: isFullscreen ? "100vw" : "100%",
            position: isFullscreen ? "fixed" : "relative",
            top: 0,
            left: 0,
            zIndex: isFullscreen ? 1300 : "auto",
            overflow: "hidden",
          }}
        >
          <GraphViewer
            data={graphData}
            graphType={graphType}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onToggleGraphType={toggleGraphType}
            includeDocuments={includeDocuments}
            includeTextUnits={includeTextUnits}
            onIncludeDocumentsChange={() =>
              setIncludeDocuments(!includeDocuments)
            }
            onIncludeTextUnitsChange={() =>
              setIncludeTextUnits(!includeTextUnits)
            }
            includeCommunities={includeCommunities}
            onIncludeCommunitiesChange={() =>
              setIncludeCommunities(!includeCommunities)
            }
            includeCovariates={includeCovariates}
            onIncludeCovariatesChange={() =>
              setIncludeCovariates(!includeCovariates)
            }
            hasDocuments={hasDocuments}
            hasTextUnits={hasTextUnits}
            hasCommunities={hasCommunities}
            hasCovariates={hasCovariates}
            maxEntities={maxEntities}
            onMaxEntitiesChange={setMaxEntities}
            totalEntities={entities.length}
          />
        </Box>
      )}

      {tabIndex === 2 && (
        <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
          <DataTableContainer
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            entities={entities}
            relationships={relationships}
            documents={documents}
            textunits={textunits}
            communities={communities}
            communityReports={communityReports}
            covariates={covariates}
          />
        </Box>
      )}

      {tabIndex === 3 && (
        <Statistics
          entities={entities}
          relationships={relationships}
          documents={documents}
          textunits={textunits}
          communities={communities}
          communityReports={communityReports}
          covariates={covariates}
        />
      )}

      {tabIndex === 4 && (
        <Box sx={{ height: "calc(100vh - 64px)", width: "100%" }}>
          <CommunityExplorer
            entities={entities}
            relationships={relationships}
            communities={communities}
            communityReports={communityReports}
          />
        </Box>
      )}
    </>
  );
};

export default GraphDataHandler;
