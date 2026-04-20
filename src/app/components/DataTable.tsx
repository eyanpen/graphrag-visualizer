import React, { useState, useMemo } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
  MRT_ColumnDef,
  MRT_VisibilityState,
} from "material-react-table";
import { Box, Chip, Stack } from "@mui/material";

interface DataTableProps<T extends object> {
  data: T[];
  columns: MRT_ColumnDef<T>[];
}

const DataTable = <T extends object>({
  data,
  columns,
}: DataTableProps<T>): React.ReactElement => {
  const defaultVisibility = useMemo(() => {
    const vis: MRT_VisibilityState = {};
    const sample = data[0] as Record<string, any> | undefined;
    columns.forEach((col) => {
      const key = (col as { accessorKey?: string }).accessorKey ?? col.id ?? "";
      if (key === "graph_embedding" || key === "description_embedding") {
        vis[key] = false;
      } else if (key === "id" || key.endsWith("_ids")) {
        vis[key] = false;
      } else if (sample && Array.isArray(sample[key])) {
        vis[key] = false;
      } else {
        vis[key] = true;
      }
    });
    return vis;
  }, [columns, data]);

  const [columnVisibility, setColumnVisibility] =
    useState<MRT_VisibilityState>(defaultVisibility);

  const table = useMaterialReactTable<T>({
    data,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    enableColumnActions: false,
    enableHiding: true,
    initialState: { density: "compact" },
  });

  const colKeys = useMemo(
    () =>
      columns.map(
        (col) => (col as { accessorKey?: string }).accessorKey ?? col.id ?? ""
      ),
    [columns]
  );

  return (
    <Box sx={{ zIndex: 1500 }}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        {colKeys.map((key) => (
          <Chip
            key={key}
            label={key}
            size="small"
            color={columnVisibility[key] !== false ? "primary" : "default"}
            variant={columnVisibility[key] !== false ? "filled" : "outlined"}
            onClick={() =>
              setColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false }))
            }
          />
        ))}
      </Stack>
      <MaterialReactTable table={table} />
    </Box>
  );
};

export default DataTable;
