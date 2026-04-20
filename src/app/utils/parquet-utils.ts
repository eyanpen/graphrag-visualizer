import { parquetRead, parquetMetadata, parquetSchema, ParquetReadOptions, SchemaTree } from "hyparquet";

export interface ParquetColumnSchema {
  name: string;
  type?: string;
  converted_type?: string;
  repetition_type?: string;
  logical_type?: string;
}

export interface ParquetSchemaInfo {
  num_rows: number;
  num_columns: number;
  columns: ParquetColumnSchema[];
  created_by?: string;
}

export const readParquetSchemaInfo = (buffer: ArrayBuffer): ParquetSchemaInfo => {
  const metadata = parquetMetadata(buffer);
  const tree = parquetSchema(metadata);
  const columns: ParquetColumnSchema[] = tree.children.map((child: SchemaTree) => ({
    name: child.element.name,
    type: child.element.type,
    converted_type: child.element.converted_type,
    repetition_type: child.element.repetition_type,
    logical_type: child.element.logical_type
      ? typeof child.element.logical_type === "object"
        ? (child.element.logical_type as { type?: string }).type
        : String(child.element.logical_type)
      : undefined,
  }));
  return {
    num_rows: Number(metadata.num_rows),
    num_columns: columns.length,
    columns,
    created_by: metadata.created_by,
  };
};

export class AsyncBuffer {
  private buffer: ArrayBuffer;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
  }

  async slice(start: number, end: number): Promise<ArrayBuffer> {
    return this.buffer.slice(start, end);
  }

  get byteLength() {
    return this.buffer.byteLength;
  }
}

const parseValue = (value: any, type: "number" | "bigint"): any => {
  if (value == null) return value;
  if (typeof value === "string" && value.endsWith("n")) {
    return BigInt(value.slice(0, -1));
  }
  return type === "bigint" ? BigInt(value) : Number(value);
};

/** Fields that should be coerced to Number per schema */
const numericFields: Record<string, Set<string>> = {
  entity: new Set(["human_readable_id", "frequency", "degree"]),
  relationship: new Set(["human_readable_id", "combined_degree"]),
  document: new Set(["human_readable_id"]),
  text_unit: new Set(["human_readable_id", "n_tokens"]),
  community: new Set(["human_readable_id", "community", "parent", "level", "size"]),
  community_report: new Set(["human_readable_id", "community", "parent", "level", "size"]),
  covariate: new Set(["human_readable_id"]),
};

/** Per-schema row transforms (special derived fields, renames, etc.) */
const rowTransforms: Record<string, (row: Record<string, any>) => Record<string, any>> = {
  relationship: (row) => ({ ...row, type: "RELATED" }),
  text_unit: (row) => ({
    ...row,
    document_ids: row["document_ids"] || (row["document_id"] ? [row["document_id"]] : []),
  }),
};

export const readParquetFile = async (
  file: File | Blob,
  schema?: string
): Promise<any[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const asyncBuffer = new AsyncBuffer(arrayBuffer);
    const nums = schema ? numericFields[schema] : undefined;
    const transform = schema ? rowTransforms[schema] : undefined;

    return new Promise((resolve, reject) => {
      const options: ParquetReadOptions = {
        file: asyncBuffer,
        rowFormat: 'object',
        onComplete: (rows: Record<string, any>[]) => {
          resolve(
            rows.map((row) => {
              const out: Record<string, any> = {};
              for (const [k, v] of Object.entries(row)) {
                out[k] = nums?.has(k) ? parseValue(v, "number") : v;
              }
              return transform ? transform(out) : out;
            })
          );
        },
      };
      parquetRead(options).catch(reject);
    });
  } catch (err) {
    console.error("Error reading Parquet file", err);
    return [];
  }
};
