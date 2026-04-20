import React, { useState, useMemo } from "react";
import {
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { MRT_ColumnDef } from "material-react-table";
import DataTable from "./DataTable";
import { Entity } from "../models/entity";
import { Relationship } from "../models/relationship";
import { Document } from "../models/document";
import { TextUnit } from "../models/text-unit";
import { Community } from "../models/community";
import { CommunityReport } from "../models/community-report";
import { Covariate } from "../models/covariate";
import { TableSchemas } from "../hooks/useFileHandler";

/** Build columns dynamically from the keys present in data rows */
function buildColumns<T extends object>(data: T[]): MRT_ColumnDef<T>[] {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    const col: MRT_ColumnDef<T> = { accessorKey: key as any, header: key };
    // Auto-render arrays as JSON
    const sample = (data[0] as any)[key];
    if (Array.isArray(sample)) {
      col.Cell = ({ renderedCellValue }) =>
        Array.isArray(renderedCellValue)
          ? JSON.stringify(renderedCellValue, null, 2)
          : renderedCellValue;
    }
    return col;
  });
}

interface DataTableContainerProps {
  selectedTable: string;
  setSelectedTable: (
    value: React.SetStateAction<
      | "entities"
      | "relationships"
      | "documents"
      | "textunits"
      | "communities"
      | "communityReports"
      | "covariates"
    >
  ) => void;
  entities: Entity[];
  relationships: Relationship[];
  documents: Document[];
  textunits: TextUnit[];
  communities: Community[];
  communityReports: CommunityReport[];
  covariates: Covariate[];
  tableSchemas?: TableSchemas;
}

const tableToSchema: Record<string, string> = {
  entities: "entity",
  relationships: "relationship",
  documents: "document",
  textunits: "text_unit",
  communities: "community",
  communityReports: "community_report",
  covariates: "covariate",
};

const SchemaPanel: React.FC<{ tableSchemas?: TableSchemas; schemaKey: string }> = ({
  tableSchemas,
  schemaKey,
}) => {
  const info = tableSchemas?.[schemaKey];
  if (!info) return null;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: "bold" }}>Column</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Converted Type</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Repetition</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {info.columns.map((col) => (
            <TableRow key={col.name}>
              <TableCell>{col.name}</TableCell>
              <TableCell>{col.logical_type || col.type || "—"}</TableCell>
              <TableCell>{col.converted_type || "—"}</TableCell>
              <TableCell>{col.repetition_type || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ px: 2, py: 0.5, fontSize: "0.8rem", color: "text.secondary" }}>
        {info.num_rows.toLocaleString()} rows · {info.num_columns} columns
        {info.created_by && ` · ${info.created_by}`}
      </Box>
    </TableContainer>
  );
};

const DataTableContainer: React.FC<DataTableContainerProps> = ({
  selectedTable,
  setSelectedTable,
  entities,
  relationships,
  documents,
  textunits,
  communities,
  communityReports,
  covariates,
  tableSchemas,
}) => {
  const [schemaOpen, setSchemaOpen] = useState(false);

  const entityCols = useMemo(() => buildColumns(entities), [entities]);
  const relationshipCols = useMemo(() => buildColumns(relationships), [relationships]);
  const documentCols = useMemo(() => buildColumns(documents), [documents]);
  const textunitCols = useMemo(() => buildColumns(textunits), [textunits]);
  const communityCols = useMemo(() => buildColumns(communities), [communities]);
  const communityReportCols = useMemo(() => buildColumns(communityReports), [communityReports]);
  const covariateCols = useMemo(() => buildColumns(covariates), [covariates]);

  const renderSection = (
    title: string,
    schemaKey: string,
    columns: any,
    data: any
  ) => (
    <>
      <Typography
        variant="h4"
        gutterBottom
        onClick={() => setSchemaOpen((prev) => !prev)}
        sx={{ cursor: "pointer", userSelect: "none", "&:hover": { opacity: 0.7 } }}
      >
        {title}
      </Typography>
      <Collapse in={schemaOpen}>
        <SchemaPanel tableSchemas={tableSchemas} schemaKey={schemaKey} />
      </Collapse>
      <DataTable columns={columns} data={data} />
    </>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: "border-box" },
        }}
      >
        <List>
          <ListItemButton
            selected={selectedTable === "entities"}
            onClick={() => { setSelectedTable("entities"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Entities" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "relationships"}
            onClick={() => { setSelectedTable("relationships"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Relationships" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "documents"}
            onClick={() => { setSelectedTable("documents"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Documents" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "textunits"}
            onClick={() => { setSelectedTable("textunits"); setSchemaOpen(false); }}
          >
            <ListItemText primary="TextUnits" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "communities"}
            onClick={() => { setSelectedTable("communities"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Communities" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "communityReports"}
            onClick={() => { setSelectedTable("communityReports"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Community Reports" />
          </ListItemButton>
          <ListItemButton
            selected={selectedTable === "covariates"}
            onClick={() => { setSelectedTable("covariates"); setSchemaOpen(false); }}
          >
            <ListItemText primary="Covariates" />
          </ListItemButton>
        </List>
      </Drawer>
      <Box p={3} sx={{ flexGrow: 1, overflow: "auto" }}>
        {selectedTable === "entities" &&
          renderSection("Entities (entities.parquet)", tableToSchema.entities, entityCols, entities)}
        {selectedTable === "relationships" &&
          renderSection("Relationships (relationships.parquet)", tableToSchema.relationships, relationshipCols, relationships)}
        {selectedTable === "documents" &&
          renderSection("Documents (documents.parquet)", tableToSchema.documents, documentCols, documents)}
        {selectedTable === "textunits" &&
          renderSection("TextUnits (text_units.parquet)", tableToSchema.textunits, textunitCols, textunits)}
        {selectedTable === "communities" &&
          renderSection("Communities (communities.parquet)", tableToSchema.communities, communityCols, communities)}
        {selectedTable === "communityReports" &&
          renderSection("Community Reports (community_reports.parquet)", tableToSchema.communityReports, communityReportCols, communityReports)}
        {selectedTable === "covariates" &&
          renderSection("Covariates (covariates.parquet)", tableToSchema.covariates, covariateCols, covariates)}
      </Box>
    </>
  );
};

export default DataTableContainer;
