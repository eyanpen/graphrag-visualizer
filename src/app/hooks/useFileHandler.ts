import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Entity } from "../models/entity";
import { Relationship } from "../models/relationship";
import { Document } from "../models/document";
import { TextUnit } from "../models/text-unit";
import { Community } from "../models/community";
import { CommunityReport } from "../models/community-report";
import { Covariate } from "../models/covariate";
import { readParquetFile } from "../utils/parquet-utils";
import agent from "../api/agent";

const baseMapping: { [key: string]: string } = {
  "entities.parquet": "entity",
  "relationships.parquet": "relationship",
  "documents.parquet": "document",
  "text_units.parquet": "text_unit",
  "communities.parquet": "community",
  "community_reports.parquet": "community_report",
  "covariates.parquet": "covariate",
};

// Build schema lookup including create_final_ prefixed variants
const fileSchemas: { [key: string]: string } = {};
Object.entries(baseMapping).forEach(([key, value]) => {
  fileSchemas[key] = value;
  fileSchemas[`create_final_${key}`] = value;
});

const useFileHandler = () => {
  const navigate = useNavigate();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [textunits, setTextUnits] = useState<TextUnit[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [covariates, setCovariates] = useState<Covariate[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Load parquet files from the GraphRAG API backend (current active data source).
   */
  const loadFromApi = async () => {
    setLoading(true);
    try {
      // Get list of available parquet files from the API
      const { files } = await agent.DataSources.listParquetFiles();

      const entitiesArray: Entity[][] = [];
      const relationshipsArray: Relationship[][] = [];
      const documentsArray: Document[][] = [];
      const textUnitsArray: TextUnit[][] = [];
      const communitiesArray: Community[][] = [];
      const communityReportsArray: CommunityReport[][] = [];
      const covariatesArray: Covariate[][] = [];

      for (const filename of files) {
        const schema = fileSchemas[filename];
        if (!schema) continue; // Skip unknown files

        try {
          // Download parquet file as ArrayBuffer from API
          const buffer = await agent.DataSources.getParquetFile(filename);
          const blob = new Blob([buffer], { type: "application/x-parquet" });
          const file = new File([blob], filename);
          const data = await readParquetFile(file, schema);

          if (schema === "entity") entitiesArray.push(data);
          else if (schema === "relationship") relationshipsArray.push(data);
          else if (schema === "document") documentsArray.push(data);
          else if (schema === "text_unit") textUnitsArray.push(data);
          else if (schema === "community") communitiesArray.push(data);
          else if (schema === "community_report") communityReportsArray.push(data);
          else if (schema === "covariate") covariatesArray.push(data);
        } catch (err) {
          console.error(`Failed to load ${filename}:`, err);
        }
      }

      setEntities(entitiesArray.flat());
      setRelationships(relationshipsArray.flat());
      setDocuments(documentsArray.flat());
      setTextUnits(textUnitsArray.flat());
      setCommunities(communitiesArray.flat());
      setCommunityReports(communityReportsArray.flat());
      setCovariates(covariatesArray.flat());

      navigate("/graph", { replace: true });
    } catch (err) {
      console.error("Failed to load data from API:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    entities,
    relationships,
    documents,
    textunits,
    communities,
    covariates,
    communityReports,
    loadFromApi,
    loading,
  };
};

export default useFileHandler;
