import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  Chip,
  Drawer,
  IconButton,
  Link,
  Typography,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Entity } from "../models/entity";
import { Relationship } from "../models/relationship";
import { Community } from "../models/community";
import { CommunityReport } from "../models/community-report";

interface CommunityExplorerProps {
  entities: Entity[];
  relationships: Relationship[];
  communities: Community[];
  communityReports: CommunityReport[];
}

interface GraphNode {
  id: string;
  name: string;
  type: "community" | "entity";
  community?: Community;
  entity?: Entity;
  report?: CommunityReport;
  val?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

const NODE_R = 8;

const CommunityExplorer: React.FC<CommunityExplorerProps> = ({
  entities,
  relationships,
  communities,
  communityReports,
}) => {
  const theme = useTheme();
  // Navigation path: array of { community, label } for breadcrumbs
  const [path, setPath] = useState<{ id: number | null; label: string }[]>([
    { id: null, label: "Top Level" },
  ]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const graphRef = useRef<any>();

  const currentParentId = path[path.length - 1].id;

  // Build lookup maps
  const entityMap = useMemo(() => {
    const m = new Map<string, Entity>();
    entities.forEach((e) => m.set(e.id, e));
    return m;
  }, [entities]);

  const reportMap = useMemo(() => {
    const m = new Map<number, CommunityReport>();
    communityReports.forEach((r) => m.set(r.community, r));
    return m;
  }, [communityReports]);

  // Find max level (top level)
  const maxLevel = useMemo(
    () => Math.max(...communities.map((c) => c.level), 0),
    [communities]
  );

  // Determine children of current view
  const childCommunities = useMemo(() => {
    if (currentParentId === null) {
      // Top level: communities at max level (no parent or parent not in dataset)
      return communities.filter((c) => c.level === maxLevel);
    }
    return communities.filter((c) => c.parent === currentParentId);
  }, [communities, currentParentId, maxLevel]);

  // Entities that belong to current community but not to any child community
  const leafEntities = useMemo(() => {
    if (currentParentId === null) return [];
    const current = communities.find((c) => c.community === currentParentId);
    if (!current) return [];

    // Collect entity_ids from child communities
    const childEntityIds = new Set<string>();
    childCommunities.forEach((child) => {
      child.entity_ids?.forEach((eid) => childEntityIds.add(eid));
    });

    // Entities in current community but not in any child
    return (current.entity_ids || [])
      .filter((eid) => !childEntityIds.has(eid))
      .map((eid) => entityMap.get(eid))
      .filter((e): e is Entity => !!e);
  }, [currentParentId, communities, childCommunities, entityMap]);

  // Build graph data for current view
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    if (childCommunities.length > 0) {
      // Show child communities as nodes
      childCommunities.forEach((c) => {
        const report = reportMap.get(c.community);
        nodes.push({
          id: `c-${c.community}`,
          name: c.title || report?.title || `Community ${c.community}`,
          type: "community",
          community: c,
          report,
          val: c.size || 1,
        });
      });

      // Links between communities that share relationships
      const communityEntitySets = new Map<string, Set<string>>();
      childCommunities.forEach((c) => {
        communityEntitySets.set(`c-${c.community}`, new Set(c.entity_ids || []));
      });

      // Create links between communities that share entity connections via relationships
      const communityIds = childCommunities.map((c) => `c-${c.community}`);
      for (let i = 0; i < communityIds.length; i++) {
        for (let j = i + 1; j < communityIds.length; j++) {
          const setA = communityEntitySets.get(communityIds[i])!;
          const setB = communityEntitySets.get(communityIds[j])!;
          // Check if any relationship connects entities across these two communities
          const hasConnection = relationships.some(
            (r) =>
              (setA.has(r.source) && setB.has(r.target)) ||
              (setB.has(r.source) && setA.has(r.target))
          );
          if (hasConnection) {
            links.push({ source: communityIds[i], target: communityIds[j] });
          }
        }
      }
    }

    // If we're inside a community, also show leaf entities
    if (currentParentId !== null) {
      const nodeIdSet = new Set(nodes.map((n) => n.id));

      leafEntities.forEach((e) => {
        const nodeId = `e-${e.id}`;
        nodes.push({
          id: nodeId,
          name: e.title,
          type: "entity",
          entity: e,
          val: 1,
        });
        nodeIdSet.add(nodeId);
      });

      // Add entity-entity relationships within this view
      const allEntityIds = new Set<string>();
      leafEntities.forEach((e) => allEntityIds.add(e.title));
      // Also include entities inside child communities for cross-links
      childCommunities.forEach((c) => {
        c.entity_ids?.forEach((eid) => {
          const ent = entityMap.get(eid);
          if (ent) allEntityIds.add(ent.title);
        });
      });

      // Entity-to-entity links (only between leaf entities in this view)
      const leafTitles = new Set(leafEntities.map((e) => e.title));
      relationships.forEach((r) => {
        if (leafTitles.has(r.source) && leafTitles.has(r.target)) {
          const srcId = `e-${entities.find((e) => e.title === r.source)?.id}`;
          const tgtId = `e-${entities.find((e) => e.title === r.target)?.id}`;
          if (nodeIdSet.has(srcId) && nodeIdSet.has(tgtId)) {
            links.push({ source: srcId, target: tgtId });
          }
        }
      });
    }

    return { nodes, links };
  }, [childCommunities, leafEntities, relationships, entities, entityMap, reportMap, currentParentId]);

  // Zoom to fit when graph data changes
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => graphRef.current.zoomToFit(400, 50), 300);
    }
  }, [graphData]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.type === "community" && node.community) {
        // Drill into this community
        const label = node.name;
        setPath((prev) => [...prev, { id: node.community!.community, label }]);
      } else if (node.type === "entity" && node.entity) {
        setSelectedEntity(node.entity);
        setDrawerOpen(true);
      }
    },
    []
  );

  const handleBreadcrumbClick = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  const getBackgroundColor = () =>
    theme.palette.mode === "dark" ? "#000000" : "#FFFFFF";

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      const r = node.type === "community" ? NODE_R * 1.5 : NODE_R;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.type === "community" ? "#ff9800" : node.color || "#4fc3f7";
      ctx.fill();

      // Label
      const label = node.name || "";
      const fontSize = node.type === "community" ? 5 : 4;
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.fillStyle = theme.palette.mode === "dark" ? "#fff" : "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, node.x, node.y + r + 2);
    },
    [theme.palette.mode]
  );

  return (
    <Box
      sx={{
        height: "calc(100vh - 64px)",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: getBackgroundColor(),
      }}
    >
      {/* Breadcrumbs */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1400,
          backgroundColor: theme.palette.mode === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)",
          borderRadius: 1,
          p: 1,
        }}
      >
        <Breadcrumbs>
          {path.map((p, i) => {
            const isLast = i === path.length - 1;
            return isLast ? (
              <Typography key={i} color="text.primary" variant="body2">
                {p.label}
              </Typography>
            ) : (
              <Link
                key={i}
                component="button"
                underline="hover"
                variant="body2"
                onClick={() => handleBreadcrumbClick(i)}
              >
                {p.label}
              </Link>
            );
          })}
        </Breadcrumbs>
        <Typography variant="caption" color="text.secondary">
          Nodes: {graphData.nodes.length} | Links: {graphData.links.length}
        </Typography>
      </Box>

      {graphData.nodes.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <Typography variant="h6" color="text.secondary">
            No communities or entities at this level
          </Typography>
        </Box>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeAutoColorBy="type"
          nodeRelSize={NODE_R}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          onNodeClick={handleNodeClick as any}
          backgroundColor={getBackgroundColor()}
          linkColor={() => (theme.palette.mode === "dark" ? "gray" : "lightgray")}
          linkWidth={1}
        />
      )}

      {/* Entity Detail Drawer */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ zIndex: 1500 }}
      >
        <Box sx={{ width: "100%", p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Node Details: {selectedEntity?.title}
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
        </Box>
      </Drawer>
    </Box>
  );
};

export default CommunityExplorer;
