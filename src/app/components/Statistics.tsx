import React, { useMemo, useState } from "react";
import {
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  Chip,
  Drawer,
  Grid,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Entity } from "../models/entity";
import { Relationship } from "../models/relationship";
import { Document } from "../models/document";
import { TextUnit } from "../models/text-unit";
import { Community } from "../models/community";
import { CommunityReport } from "../models/community-report";
import { Covariate } from "../models/covariate";

interface StatisticsProps {
  entities: Entity[];
  relationships: Relationship[];
  documents: Document[];
  textunits: TextUnit[];
  communities: Community[];
  communityReports: CommunityReport[];
  covariates: Covariate[];
}

function countByField<T>(items: T[], field: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const key = String(item[field] ?? "unknown");
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

// Drill-down state: which breakdown table was clicked, and which type value
interface DrillDown {
  category: "entity" | "relationship" | "community";
  typeValue: string;
}

const Statistics: React.FC<StatisticsProps> = ({
  entities,
  relationships,
  documents,
  textunits,
  communities,
  communityReports,
  covariates,
}) => {
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const entityTypeCounts = useMemo(() => countByField(entities, "type"), [entities]);
  const relationshipTypeCounts = useMemo(() => countByField(relationships, "type"), [relationships]);
  const communityLevelCounts = useMemo(() => countByField(communities, "level"), [communities]);

  const overviewRows = [
    { label: "Entities", count: entities.length },
    { label: "Relationships", count: relationships.length },
    { label: "Documents", count: documents.length },
    { label: "Text Units", count: textunits.length },
    { label: "Communities", count: communities.length },
    { label: "Community Reports", count: communityReports.length },
    { label: "Covariates", count: covariates.length },
  ];

  // Filtered items for drill-down list
  const drillDownItems = useMemo(() => {
    if (!drillDown) return [];
    if (drillDown.category === "entity") {
      return entities.filter((e) => String(e.type) === drillDown.typeValue);
    }
    if (drillDown.category === "relationship") {
      return relationships.filter((r) => String(r.type) === drillDown.typeValue);
    }
    if (drillDown.category === "community") {
      return communities.filter((c) => String(c.level) === drillDown.typeValue);
    }
    return [];
  }, [drillDown, entities, relationships, communities]);

  const handleTypeClick = (category: DrillDown["category"], typeValue: string) => {
    setDrillDown({ category, typeValue });
  };

  const handleItemClick = (item: Entity | Relationship | Community) => {
    if (drillDown?.category === "entity") {
      setSelectedEntity(item as Entity);
      setSelectedRelationship(null);
      setSelectedCommunity(null);
    } else if (drillDown?.category === "relationship") {
      setSelectedRelationship(item as Relationship);
      setSelectedEntity(null);
      setSelectedCommunity(null);
    } else if (drillDown?.category === "community") {
      setSelectedCommunity(item as Community);
      setSelectedEntity(null);
      setSelectedRelationship(null);
    }
    setDrawerOpen(true);
  };

  const handleBack = () => {
    setDrillDown(null);
  };

  const categoryLabel = drillDown
    ? drillDown.category === "entity"
      ? "Entity Types"
      : drillDown.category === "relationship"
      ? "Relationship Types"
      : "Community Levels"
    : "";

  // --- Render drill-down list view ---
  if (drillDown) {
    return (
      <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component="button" underline="hover" onClick={handleBack}>
            Statistics
          </Link>
          <Link component="button" underline="hover" onClick={handleBack}>
            {categoryLabel}
          </Link>
          <Typography color="text.primary">{drillDown.typeValue}</Typography>
        </Breadcrumbs>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {categoryLabel}: {drillDown.typeValue} ({drillDownItems.length})
          </Typography>
          <Box sx={{ maxHeight: "calc(100vh - 250px)", overflow: "auto", display: "flex", flexWrap: "wrap", gap: 0.5, pt: 1 }}>
            {drillDownItems.map((item, idx) => {
              const label =
                drillDown.category === "relationship"
                  ? `${(item as Relationship).source} → ${(item as Relationship).target}`
                  : (item as Entity | Community).title;
              return (
                <Chip
                  key={(item as any).id ?? idx}
                  label={label}
                  size="small"
                  clickable
                  onClick={() => handleItemClick(item as any)}
                />
              );
            })}
          </Box>
        </Paper>

        {/* Detail Drawer */}
        <Drawer
          anchor="bottom"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{ zIndex: 1500 }}
        >
          <Box sx={{ width: "100%", p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                {selectedEntity && `Entity: ${selectedEntity.title}`}
                {selectedRelationship && `Relationship: ${selectedRelationship.source} → ${selectedRelationship.target}`}
                {selectedCommunity && `Community: ${selectedCommunity.title}`}
              </Typography>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            {selectedEntity && (
              <Card>
                <CardContent>
                  <Typography>ID: {selectedEntity.id}</Typography>
                  <Typography>Title: {selectedEntity.title}</Typography>
                  <Typography>
                    Type: <Chip label={selectedEntity.type} size="small" />
                  </Typography>
                  <Typography>Description: {selectedEntity.description}</Typography>
                  {selectedEntity.human_readable_id != null && (
                    <Typography>Human Readable ID: {selectedEntity.human_readable_id}</Typography>
                  )}
                  {selectedEntity.text_unit_ids?.length > 0 && (
                    <Typography>Text Unit IDs: {selectedEntity.text_unit_ids.join(", ")}</Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedRelationship && (
              <Card>
                <CardContent>
                  <Typography>ID: {selectedRelationship.id}</Typography>
                  <Typography>Source: {selectedRelationship.source}</Typography>
                  <Typography>Target: {selectedRelationship.target}</Typography>
                  <Typography>
                    Type: <Chip label={selectedRelationship.type} size="small" />
                  </Typography>
                  <Typography>Description: {selectedRelationship.description}</Typography>
                  <Typography>Weight: {selectedRelationship.weight}</Typography>
                  <Typography>Combined Degree: {selectedRelationship.combined_degree}</Typography>
                  {selectedRelationship.text_unit_ids?.length > 0 && (
                    <Typography>Text Unit IDs: {selectedRelationship.text_unit_ids.join(", ")}</Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedCommunity && (
              <Card>
                <CardContent>
                  <Typography>ID: {selectedCommunity.id}</Typography>
                  <Typography>Title: {selectedCommunity.title}</Typography>
                  <Typography>Level: {selectedCommunity.level}</Typography>
                  <Typography>Size: {selectedCommunity.size}</Typography>
                  {selectedCommunity.parent != null && (
                    <Typography>Parent: {selectedCommunity.parent}</Typography>
                  )}
                  {selectedCommunity.entity_ids?.length > 0 && (
                    <Typography>Entity IDs: {selectedCommunity.entity_ids.join(", ")}</Typography>
                  )}
                  {selectedCommunity.relationship_ids?.length > 0 && (
                    <Typography>Relationship IDs: {selectedCommunity.relationship_ids.join(", ")}</Typography>
                  )}
                  {selectedCommunity.text_unit_ids?.length > 0 && (
                    <Typography>Text Unit IDs: {selectedCommunity.text_unit_ids.join(", ")}</Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </Drawer>
      </Box>
    );
  }

  // --- Render overview ---
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Data Overview
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Total Rows</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overviewRows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell align="right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Grid container spacing={3}>
        {[
          { title: "Entity Types", counts: entityTypeCounts, category: "entity" as const },
          { title: "Relationship Types", counts: relationshipTypeCounts, category: "relationship" as const },
          { title: "Community Levels", counts: communityLevelCounts, category: "community" as const },
        ].map(({ title, counts, category }) => {
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          return (
            <Grid item xs={12} md={4} key={category}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {title} ({sorted.length} types)
                </Typography>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sorted.map(([type, count]) => (
                        <TableRow
                          key={type}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => handleTypeClick(category, type)}
                        >
                          <TableCell>
                            <Link component="button" underline="hover">
                              {type}
                            </Link>
                          </TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Statistics;
