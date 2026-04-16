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
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { forceX, forceY } from "d3-force-3d";
import { Entity } from "../models/entity";
import { Relationship } from "../models/relationship";
import { Community } from "../models/community";
import { CommunityReport } from "../models/community-report";
import { TextUnit } from "../models/text-unit";

interface CommunityExplorerProps {
  entities: Entity[];
  relationships: Relationship[];
  communities: Community[];
  communityReports: CommunityReport[];
  textunits: TextUnit[];
}

interface GraphNode {
  id: string;
  name: string;
  type: "community" | "entity" | "textunit";
  community?: Community;
  entity?: Entity;
  textunit?: TextUnit;
  report?: CommunityReport;
  val?: number;
  count?: number; // element count for community nodes
}

interface GraphLink {
  source: string;
  target: string;
  type?: string;
}

const NODE_R = 8;

const CommunityExplorer: React.FC<CommunityExplorerProps> = ({
  entities,
  relationships,
  communities,
  communityReports,
  textunits,
}) => {
  const theme = useTheme();
  const [path, setPath] = useState<{ id: number | null; label: string }[]>([
    { id: null, label: "Top Level" },
  ]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [labelMode, setLabelMode] = useState<"auto" | "on" | "off">("auto");
  const graphRef = useRef<any>();

  const currentParentId = path[path.length - 1].id;

  // Build lookup maps
  const entityMap = useMemo(() => {
    const m = new Map<string, Entity>();
    entities.forEach((e) => m.set(e.id, e));
    return m;
  }, [entities]);

  // Entity title -> entity id lookup (relationships use title as source/target)
  const entityTitleToId = useMemo(() => {
    const m = new Map<string, string>();
    entities.forEach((e) => m.set(e.title, e.id));
    return m;
  }, [entities]);

  const textunitMap = useMemo(() => {
    const m = new Map<string, TextUnit>();
    textunits.forEach((t) => m.set(t.id, t));
    return m;
  }, [textunits]);

  const relationshipMap = useMemo(() => {
    const m = new Map<string, Relationship>();
    relationships.forEach((r) => m.set(r.id, r));
    return m;
  }, [relationships]);

  const reportMap = useMemo(() => {
    const m = new Map<number, CommunityReport>();
    communityReports.forEach((r) => m.set(r.community, r));
    return m;
  }, [communityReports]);

  const childCommunities = useMemo(() => {
    if (currentParentId === null) {
      // Top level: communities whose parent is -1
      return communities.filter((c) => c.parent === -1 || c.parent == null);
    }
    return communities.filter((c) => c.parent === currentParentId);
  }, [communities, currentParentId]);

  // Current community object
  const currentCommunity = useMemo(() => {
    if (currentParentId === null) return null;
    return communities.find((c) => c.community === currentParentId) || null;
  }, [communities, currentParentId]);

  // Entities belonging to current community (not claimed by child communities)
  const currentEntities = useMemo(() => {
    if (!currentCommunity) return [];
    const childEntityIds = new Set<string>();
    childCommunities.forEach((child) => {
      child.entity_ids?.forEach((eid) => childEntityIds.add(eid));
    });
    return (currentCommunity.entity_ids || [])
      .filter((eid) => !childEntityIds.has(eid))
      .map((eid) => entityMap.get(eid))
      .filter((e): e is Entity => !!e);
  }, [currentCommunity, childCommunities, entityMap]);

  // Text units belonging to current community (not claimed by child communities)
  const currentTextUnits = useMemo(() => {
    if (!currentCommunity) return [];
    const childTextUnitIds = new Set<string>();
    childCommunities.forEach((child) => {
      child.text_unit_ids?.forEach((tid) => childTextUnitIds.add(tid));
    });
    return (currentCommunity.text_unit_ids || [])
      .filter((tid) => !childTextUnitIds.has(tid))
      .map((tid) => textunitMap.get(tid))
      .filter((t): t is TextUnit => !!t);
  }, [currentCommunity, childCommunities, textunitMap]);

  // Build graph data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIdSet = new Set<string>();

    // Child community nodes
    childCommunities.forEach((c) => {
      const report = reportMap.get(c.community);
      const childCount = communities.filter((cc) => cc.parent === c.community).length;
      const count = childCount + (c.entity_ids?.length || 0) + (c.text_unit_ids?.length || 0);
      const nodeId = `c-${c.community}`;
      nodes.push({
        id: nodeId,
        name: report?.title || c.title || `Community ${c.community}`,
        type: "community",
        community: c,
        report,
        val: c.size || 1,
        count,
      });
      nodeIdSet.add(nodeId);
    });

    // Entity nodes for current community
    currentEntities.forEach((e) => {
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

    // Text unit nodes for current community
    currentTextUnits.forEach((t) => {
      const nodeId = `t-${t.id}`;
      nodes.push({
        id: nodeId,
        name: `TU ${t.human_readable_id}`,
        type: "textunit",
        textunit: t,
        val: 1,
      });
      nodeIdSet.add(nodeId);
    });

    // Use relationship_ids from current community to create links
    if (currentCommunity) {
      const relIds = currentCommunity.relationship_ids || [];
      relIds.forEach((rid) => {
        const rel = relationshipMap.get(rid);
        if (!rel) return;

        // Resolve source/target (relationship uses entity title)
        const srcEntityId = entityTitleToId.get(rel.source);
        const tgtEntityId = entityTitleToId.get(rel.target);
        if (!srcEntityId || !tgtEntityId) return;

        const srcNodeId = `e-${srcEntityId}`;
        const tgtNodeId = `e-${tgtEntityId}`;

        if (nodeIdSet.has(srcNodeId) && nodeIdSet.has(tgtNodeId)) {
          links.push({ source: srcNodeId, target: tgtNodeId, type: rel.description });
        }
      });

      // Text unit -> entity links (HAS_ENTITY)
      currentTextUnits.forEach((t) => {
        const tuNodeId = `t-${t.id}`;
        (t.entity_ids || []).forEach((eid) => {
          const eNodeId = `e-${eid}`;
          if (nodeIdSet.has(eNodeId)) {
            links.push({ source: tuNodeId, target: eNodeId, type: "HAS_ENTITY" });
          }
        });
      });
    }

    // Community-to-community links (shared relationships across entity sets)
    if (childCommunities.length > 1) {
      const communityEntitySets = new Map<string, Set<string>>();
      childCommunities.forEach((c) => {
        communityEntitySets.set(`c-${c.community}`, new Set(c.entity_ids || []));
      });
      const cIds = childCommunities.map((c) => `c-${c.community}`);
      for (let i = 0; i < cIds.length; i++) {
        for (let j = i + 1; j < cIds.length; j++) {
          const setA = communityEntitySets.get(cIds[i])!;
          const setB = communityEntitySets.get(cIds[j])!;
          const hasConn = relationships.some(
            (r) => {
              const srcId = entityTitleToId.get(r.source);
              const tgtId = entityTitleToId.get(r.target);
              return srcId && tgtId && (
                (setA.has(srcId) && setB.has(tgtId)) ||
                (setB.has(srcId) && setA.has(tgtId))
              );
            }
          );
          if (hasConn) {
            links.push({ source: cIds[i], target: cIds[j] });
          }
        }
      }
    }

    return { nodes, links };
  }, [childCommunities, currentEntities, currentTextUnits, currentCommunity, relationships, relationshipMap, entityTitleToId, reportMap, communities, textunits]);

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.d3Force("charge").strength(-300).distanceMax(500);
      graphRef.current.d3Force("link")?.distance(150);
      // Pull isolated nodes toward center
      const isolatedIds = new Set(
        graphData.nodes
          .filter((n) => !graphData.links.some(
            (l: any) => (l.source?.id ?? l.source) === n.id || (l.target?.id ?? l.target) === n.id
          ))
          .map((n) => n.id)
      );
      graphRef.current.d3Force("pullX", forceX(0).strength((node: any) => isolatedIds.has(node.id) ? 0.3 : 0.01));
      graphRef.current.d3Force("pullY", forceY(0).strength((node: any) => isolatedIds.has(node.id) ? 0.3 : 0.01));
      graphRef.current.d3ReheatSimulation();
      setTimeout(() => graphRef.current.zoomToFit(400, 50), 500);
    }
  }, [graphData]);

  const lastClickRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const now = Date.now();
      const last = lastClickRef.current;
      if (node.type === "community" && node.community) {
        if (last.id === node.id && now - last.time < 400) {
          // Double click: drill down
          setPath((prev) => [...prev, { id: node.community!.community, label: node.name }]);
          lastClickRef.current = { id: "", time: 0 };
        } else {
          // Single click: show details (delayed to allow double-click detection)
          lastClickRef.current = { id: node.id, time: now };
          setTimeout(() => {
            if (lastClickRef.current.id === node.id && lastClickRef.current.time === now) {
              setSelectedNode(node);
              setDrawerOpen(true);
            }
          }, 400);
        }
      } else {
        setSelectedNode(node);
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

  const showLabels = labelMode === "on" || (labelMode === "auto" && graphData.nodes.length <= 10);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      if (node.type === "community") {
        const r = NODE_R * 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = "#ff9800";
        ctx.fill();

        const countStr = String(node.count ?? 0);
        ctx.font = `bold 6px Sans-Serif`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(countStr, node.x, node.y);

        if (showLabels) {
          ctx.font = `5px Sans-Serif`;
          ctx.fillStyle = theme.palette.mode === "dark" ? "#fff" : "#000";
          ctx.textBaseline = "top";
          ctx.fillText(node.name || "", node.x, node.y + r + 2);
        }
      } else if (node.type === "textunit") {
        const r = NODE_R * 0.8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = "#66bb6a";
        ctx.fill();

        if (showLabels) {
          ctx.font = `3.5px Sans-Serif`;
          ctx.fillStyle = theme.palette.mode === "dark" ? "#fff" : "#000";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(node.name || "", node.x, node.y + r + 1);
        }
      } else {
        const r = NODE_R;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color || "#4fc3f7";
        ctx.fill();

        if (showLabels) {
          ctx.font = `4px Sans-Serif`;
          ctx.fillStyle = theme.palette.mode === "dark" ? "#fff" : "#000";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(node.name || "", node.x, node.y + r + 2);
        }
      }
    },
    [theme.palette.mode, showLabels]
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
        <ToggleButtonGroup
          value={labelMode}
          exclusive
          size="small"
          onChange={(_, v) => v && setLabelMode(v)}
          sx={{ mt: 0.5 }}
        >
          <ToggleButton value="auto">Auto</ToggleButton>
          <ToggleButton value="on">Labels</ToggleButton>
          <ToggleButton value="off">Off</ToggleButton>
        </ToggleButtonGroup>
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
          d3VelocityDecay={0.3}
          d3AlphaDecay={0.01}
          onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
        />
      )}

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
              {selectedNode?.type === "community" && `Community: ${selectedNode.name}`}
              {selectedNode?.type === "entity" && `Entity: ${selectedNode.entity?.title}`}
              {selectedNode?.type === "textunit" && `Text Unit: ${selectedNode.textunit?.id}`}
            </Typography>
            <IconButton onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {selectedNode?.type === "community" && selectedNode.community && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                {selectedNode.report ? (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold">Community Report</Typography>
                    <Typography>Title: {selectedNode.report.title}</Typography>
                    <Typography>Summary: {selectedNode.report.summary}</Typography>
                    <Typography>Level: {selectedNode.report.level}</Typography>
                    <Typography>Rank: {selectedNode.report.rank}</Typography>
                    {selectedNode.report.rank_explanation && (
                      <Typography>Rank Explanation: {selectedNode.report.rank_explanation}</Typography>
                    )}
                    {selectedNode.report.findings?.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Findings:</Typography>
                        {selectedNode.report.findings.map((f, i) => (
                          <Box key={i} sx={{ ml: 2, mb: 1 }}>
                            <Typography variant="body2" fontWeight="bold">{f.summary}</Typography>
                            <Typography variant="body2">{f.explanation}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                    {selectedNode.report.full_content && (
                      <Typography sx={{ whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto", mt: 1 }}>
                        {selectedNode.report.full_content}
                      </Typography>
                    )}
                  </>
                ) : (
                  <>
                    <Typography>Community: {selectedNode.community.community}</Typography>
                    <Typography>Level: {selectedNode.community.level}</Typography>
                    <Typography>Size: {selectedNode.community.size}</Typography>
                    <Typography>Entities: {selectedNode.community.entity_ids?.length || 0}</Typography>
                    <Typography>Text Units: {selectedNode.community.text_unit_ids?.length || 0}</Typography>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {selectedNode?.type === "entity" && selectedNode.entity && (
            <Card>
              <CardContent>
                <Typography>ID: {selectedNode.entity.id}</Typography>
                <Typography>Title: {selectedNode.entity.title}</Typography>
                <Typography>
                  Type: <Chip label={selectedNode.entity.type} size="small" />
                </Typography>
                <Typography>Description: {selectedNode.entity.description}</Typography>
                {selectedNode.entity.human_readable_id != null && (
                  <Typography>Human Readable ID: {selectedNode.entity.human_readable_id}</Typography>
                )}
                {selectedNode.entity.text_unit_ids?.length > 0 && (
                  <Typography>Text Unit IDs: {selectedNode.entity.text_unit_ids.join(", ")}</Typography>
                )}
              </CardContent>
            </Card>
          )}

          {selectedNode?.type === "textunit" && selectedNode.textunit && (
            <Card>
              <CardContent>
                <Typography>ID: {selectedNode.textunit.id}</Typography>
                <Typography>Tokens: {selectedNode.textunit.n_tokens}</Typography>
                <Typography sx={{ whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>
                  Text: {selectedNode.textunit.text}
                </Typography>
                {selectedNode.textunit.document_ids?.length > 0 && (
                  <Typography>Document IDs: {selectedNode.textunit.document_ids.join(", ")}</Typography>
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
