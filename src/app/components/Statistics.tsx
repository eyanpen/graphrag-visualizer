import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Grid,
} from "@mui/material";
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

const TypeBreakdownTable: React.FC<{ title: string; counts: Record<string, number> }> = ({
  title,
  counts,
}) => {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
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
              <TableRow key={type}>
                <TableCell>{type}</TableCell>
                <TableCell align="right">{count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

const Statistics: React.FC<StatisticsProps> = ({
  entities,
  relationships,
  documents,
  textunits,
  communities,
  communityReports,
  covariates,
}) => {
  const entityTypeCounts = useMemo(() => countByField(entities, "type"), [entities]);
  const communityLevelCounts = useMemo(() => countByField(communities, "level"), [communities]);
  const relationshipTypeCounts = useMemo(() => countByField(relationships, "type"), [relationships]);

  const overviewRows = [
    { label: "Entities", count: entities.length },
    { label: "Relationships", count: relationships.length },
    { label: "Documents", count: documents.length },
    { label: "Text Units", count: textunits.length },
    { label: "Communities", count: communities.length },
    { label: "Community Reports", count: communityReports.length },
    { label: "Covariates", count: covariates.length },
  ];

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
        <Grid item xs={12} md={4}>
          <TypeBreakdownTable title="Entity Types" counts={entityTypeCounts} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TypeBreakdownTable title="Relationship Types" counts={relationshipTypeCounts} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TypeBreakdownTable title="Community Levels" counts={communityLevelCounts} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Statistics;
