// src/types.ts

export type NodeType = 'section' | 'entity' | 'concept' | 'index';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;          // e.g. "term:income", "index:title-26_section-61"
  name: string;        // human-readable label
  val?: number;         // used for node size (degree) - computed at runtime
  totalVal?: number;   // degree before filtering - computed at runtime
  color?: string;      // computed at runtime based on type + degree
  baseColor?: string;  // computed at runtime
  node_type: NodeType; // Required

  // NEW: Index/Section-specific metadata (from indexes_output.csv)
  title?: string | null;     // parsed from name (e.g., "26")
  part?: string | null;      // parsed from name
  chapter?: string | null;   // parsed from name
  subchapter?: string | null;// parsed from name
  section?: string | null;   // parsed from name
  display_label?: string | null; // ✅ ADDED: e.g., "[26 U.S.C. 61]"

  // ✅ NEW: Properties object containing all data from CSV
  properties?: {
    full_name?: string;        // From indexes: full name of statute
    text?: string;             // From indexes: section text content
    definition?: string;       // ✅ ADDED: From terms that are defined
    embedding?: number[];      // From both indexes and terms
    full_name_embedding?: number[]; // From indexes
    [key: string]: any;        // Allow any other properties
  };

  // LEGACY/COMPATIBILITY: Keep these at top level for backward compatibility
  full_name?: string;
  text?: string;
  section_num?: string | number;
  section_heading?: string | null;
  section_text?: string | null;
  title_num?: number;
  entity?: string | null;
  tag?: string | null;
  term_type?: string;        // 'Entity' or 'Concept' from old data
  index_type?: string;       // 'Index' from old data

  // D3 simulation properties (from d3.SimulationNodeDatum)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  edge_type: 'definition' | 'reference' | 'hierarchy'; // ✅ More specific type
  action: string;              // 'defines', 'references', 'includes'
  
  // Optional edge properties
  definition?: string;         // For definition edges
  location?: string;
  timestamp?: string;
  weight?: number;
  count?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Relationship objects for lists / right sidebar.
export interface Relationship {
  id: number;
  doc_id: string;
  timestamp: string | null;
  actor: string;          // label of source node
  action: string;
  target: string;         // label of target node
  location: string | null;
  tags: string[];

  actor_type?: NodeType;
  target_type?: NodeType;
  actor_id?: string;
  target_id?: string;
  
  definition?: string;    // For definition relationships
}

export interface Actor {
  name: string;
  connection_count: number;
}

export interface Stats {
  totalDocuments: { count: number };
  totalTriples: { count: number };
  totalActors: { count: number };
  categories: { category: string; count: number }[];
}

export interface Document {
  doc_id: string;
  file_path: string;
  one_sentence_summary: string;
  paragraph_summary: string;
  category: string;
  date_range_earliest: string | null;
  date_range_latest: string | null;
  
  // NEW: Add fields from new data structure
  full_name?: string;
  text?: string;
  title?: string | null;
  part?: string | null;
  chapter?: string | null;
  subchapter?: string | null;
  section?: string | null;
}

export interface TagCluster {
  id: number;
  name: string;
  exemplars: string[];
  tagCount: number;
}

export interface NetworkBuilderState {
  // Keyword search
  searchTerms: string[];
  searchFields: ('text' | 'full_name' | 'display_label' | 'definition' | 'entity' | 'concept' | 'properties')[]; // ✅ UPDATED: New search fields
  
  // Node type filters
  allowedNodeTypes: ('section' | 'entity' | 'concept' | 'index')[]; // ✅ ADDED 'index'
  
  // Edge type filters
  allowedEdgeTypes: ('definition' | 'reference' | 'hierarchy')[];
  
  // Title/section filters (keep for potential future use)
  allowedTitles: number[];
  allowedSections: string[];
  
  // Expansion settings
  seedNodeIds: string[];
  expansionDepth: number;
  maxNodesPerExpansion: number;
  
  // Overall cap
  maxTotalNodes: number;
}

export interface FilteredGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  truncated: boolean;
  matchedCount: number;
}
