// src/services/networkBuilder.ts

import type { GraphNode, GraphLink, NetworkBuilderState, FilteredGraph } from '../types';

export class NetworkBuilder {
  private allNodes: GraphNode[];
  private allLinks: GraphLink[];
  private adjacencyMap: Map<string, Array<{ neighborId: string; edgeType: string }>>;

  constructor(nodes: GraphNode[], links: GraphLink[]) {
    this.allNodes = nodes;
    this.allLinks = links;
    
    // Build adjacency map for O(1) neighbor lookups
    console.log('🔧 Building adjacency map for fast graph traversal...');
    const startTime = performance.now();
    
    this.adjacencyMap = new Map();
    
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const edgeType = link.edge_type;
      
      // Initialize arrays if needed
      if (!this.adjacencyMap.has(sourceId)) {
        this.adjacencyMap.set(sourceId, []);
      }
      if (!this.adjacencyMap.has(targetId)) {
        this.adjacencyMap.set(targetId, []);
      }
      
      // Add bidirectional edges
      this.adjacencyMap.get(sourceId)!.push({ neighborId: targetId, edgeType });
      this.adjacencyMap.get(targetId)!.push({ neighborId: sourceId, edgeType });
    });
    
    console.log(`✅ Adjacency map built in ${(performance.now() - startTime).toFixed(2)}ms`);
  }


  /**
   * Multi-field keyword search with case-insensitive matching and AND/OR logic
   * Now searches through properties object for new data structure
   */
  searchNodes(searchTerms: string[], searchFields: string[], logic: 'AND' | 'OR' = 'OR'): Set<string> {
    const matchedIds = new Set<string>();
    const normalizedTerms = searchTerms.map(t => t.toLowerCase().trim());

    console.log('Searching for terms:', normalizedTerms);
    console.log('Searching in fields:', searchFields);
    console.log('Search logic:', logic);

    this.allNodes.forEach(node => {
      const searchableValues: string[] = [];
      
      // Collect all searchable string values based on selected fields
      searchFields.forEach(field => {
        let value: any;
        
        switch(field) {
          case 'text':
            // Check properties first, then fall back to top-level
            value = node.properties?.text || node.text || node.section_text || node.index_heading;
            break;
          case 'full_name':
            value = node.properties?.full_name || node.full_name;
            break;
          case 'display_label':
            value = node.display_label;
            break;
          case 'definition':
            value = node.properties?.definition;
            break;
          case 'entity':
            value = node.node_type === 'entity' ? node.name : null;
            break;
          case 'concept':
            value = node.node_type === 'concept' ? node.name : null;
            break;
          case 'properties':
            // ✅ NEW: Search through ALL string properties in the properties object
            if (node.properties && typeof node.properties === 'object') {
              Object.values(node.properties).forEach(propValue => {
                if (typeof propValue === 'string') {
                  searchableValues.push(propValue.toLowerCase());
                }
              });
            }
            return; // Skip adding to searchableValues below since we already added them
          // LEGACY fields for backward compatibility
          case 'section_text':
            value = node.section_text || node.properties?.text || node.text;
            break;
          case 'section_heading':
            value = node.section_heading;
            break;
          case 'section_num':
            value = node.section_num;
            break;
          case 'tag':
            value = node.node_type === 'concept' ? node.name : null;
            break;
          default:
            value = (node as any)[field];
        }

        if (value !== null && value !== undefined) {
          searchableValues.push(String(value).toLowerCase());
        }
      });

      // Apply AND/OR logic
      if (logic === 'OR') {
        // OR logic: match if ANY term appears in ANY searchable value
        const shouldMatch = normalizedTerms.some(term => {
          return searchableValues.some(searchableValue => 
            searchableValue.includes(term)
          );
        });

        if (shouldMatch) {
          matchedIds.add(node.id);
        }
      } else {
        // AND logic: match if ALL terms appear (in ANY of the searchable values)
        const allTermsMatch = normalizedTerms.every(term => {
          return searchableValues.some(searchableValue => 
            searchableValue.includes(term)
          );
        });

        if (allTermsMatch) {
          matchedIds.add(node.id);
        }
      }
    });

    console.log(`Found ${matchedIds.size} matching nodes using ${logic} logic`);

	// ✅ ADD THIS - Show sample matched nodes
if (matchedIds.size > 0) {
  const sampleMatches = Array.from(matchedIds).slice(0, 5);
  console.log('Sample matched node IDs:', sampleMatches);
  console.log('Sample matched nodes:', sampleMatches.map(id => {
    const node = this.allNodes.find(n => n.id === id);
    return { id: node?.id, name: node?.name, type: node?.node_type };
  }));
}
    return matchedIds;
  }

  /**
   * Filter nodes by type, title, or section
   */
  filterByAttributes(
    allowedNodeTypes: string[],
    allowedTitles: number[],
    allowedSections: string[]
  ): Set<string> {
    const matchedIds = new Set<string>();

    this.allNodes.forEach(node => {
      // Type filter - if empty, allow all
      const typeMatch = allowedNodeTypes.length === 0 || 
                       allowedNodeTypes.includes(node.node_type);
      
      // Title filter - if empty, allow all
      // Check for both 'section' and 'index' node types
      const titleMatch = allowedTitles.length === 0 || 
                        ((node.node_type === 'section' || node.node_type === 'index') && 
                         ((node.title_num && allowedTitles.includes(node.title_num)) ||
                          (node.title && allowedTitles.includes(parseInt(node.title)))));
      
      // Section number filter - if empty, allow all
      const sectionMatch = allowedSections.length === 0 || 
                          (node.section_num && 
                           allowedSections.some(s => 
                             String(node.section_num).toLowerCase().includes(String(s).toLowerCase())
                           ));

      // If type filter is active, use it; otherwise check title/section
      if (allowedNodeTypes.length > 0) {
        if (typeMatch) {
          matchedIds.add(node.id);
        }
      } else {
        // No type filter, so check title and section
        if (allowedTitles.length === 0 && allowedSections.length === 0) {
          // No filters at all, include everything
          matchedIds.add(node.id);
        } else if (titleMatch || sectionMatch) {
          matchedIds.add(node.id);
        }
      }
    });

    console.log(`Attribute filter matched ${matchedIds.size} nodes`);
    return matchedIds;
  }

 /**
 * Expand from seed nodes by N hops, limiting neighbors per node
 * Optimized using pre-built adjacency map for O(1) lookups
 */
expandFromSeeds(
  seedIds: Set<string>,
  depth: number,
  maxNeighborsPerNode: number,
  allowedEdgeTypes: string[]
): Set<string> {
  const expanded = new Set<string>(seedIds);
  let currentLayer = new Set<string>(seedIds);

  for (let i = 0; i < depth; i++) {
    const nextLayer = new Set<string>();

    currentLayer.forEach(nodeId => {
      // ✅ O(1) lookup instead of filtering all links
      const neighbors = this.adjacencyMap.get(nodeId) || [];
      
      // Filter by edge type if specified
      const filteredNeighbors = allowedEdgeTypes.length === 0
        ? neighbors
        : neighbors.filter(n => allowedEdgeTypes.includes(n.edgeType));
      
      // Limit neighbors if needed
      const limitedNeighbors = maxNeighborsPerNode > 0 
        ? filteredNeighbors.slice(0, maxNeighborsPerNode)
        : filteredNeighbors;

      limitedNeighbors.forEach(({ neighborId }) => {
        if (!expanded.has(neighborId)) {
          nextLayer.add(neighborId);
          expanded.add(neighborId);
        }
      });
    });

    currentLayer = nextLayer;
    if (currentLayer.size === 0) break;
  }

  console.log(`Expansion from ${seedIds.size} seeds resulted in ${expanded.size} nodes`);
  return expanded;
}

/**
 * Build network from current filter state
 */
buildNetwork(state: NetworkBuilderState, searchLogic: 'AND' | 'OR' = 'OR', nodeRankingMode: 'global' | 'subgraph' = 'global'): FilteredGraph {

  const startTime = performance.now();
  console.log('🔍 Starting buildNetwork...');

  console.log('Building network with state:', state);
  console.log('Search logic:', searchLogic);

  console.log('=== Checking properties preservation ===');
  console.log('Sample node from allNodes:', this.allNodes[0]);
  console.log('Does it have properties?', (this.allNodes[0] as any)?.properties);
  console.log('Properties.text?', (this.allNodes[0] as any)?.properties?.text);
  
  let candidateNodeIds = new Set<string>();
  let seedNodeIds = new Set<string>();

  // Step 1: Apply keyword search if present
  const step1Start = performance.now();
  if (state.searchTerms.length > 0 && state.searchFields.length > 0) {
    seedNodeIds = this.searchNodes(state.searchTerms, state.searchFields, searchLogic);
    console.log(`⏱️ Step 1 (searchNodes): ${(performance.now() - step1Start).toFixed(2)}ms`);

    if (seedNodeIds.size === 0) {
      console.warn('No nodes matched the search terms!');
      return {
        nodes: [],
        links: [],
        truncated: false,
        matchedCount: 0
      };
    }
    
    console.log(`Found ${seedNodeIds.size} seed nodes from search`);
    
    // Step 1b: Expand from seed nodes if expansion depth > 0
    const expandStart = performance.now();

    if (state.expansionDepth > 0) {
      console.log(`Expanding ${state.expansionDepth} degree(s) from seed nodes...`);
      candidateNodeIds = this.expandFromSeeds(
        seedNodeIds,
        state.expansionDepth,
        state.maxNodesPerExpansion,
        state.allowedEdgeTypes
      );
     console.log(`⏱️ Step 1b (expandFromSeeds): ${(performance.now() - expandStart).toFixed(2)}ms`);

    } else {
      // No expansion, just use the seed nodes
      candidateNodeIds = new Set(seedNodeIds);
    }
  } else {
    // Start with all nodes if no search
    candidateNodeIds = new Set(this.allNodes.map(n => n.id));
    console.log('No search terms, starting with all nodes:', candidateNodeIds.size);
  }

  // Step 2: Apply attribute filters ONLY to seed nodes, not expanded nodes
  const shouldFilterSeeds = state.searchTerms.length > 0 && state.searchFields.length > 0;

  if (shouldFilterSeeds && state.allowedNodeTypes.length > 0) {
    // Filter only the seed nodes by type
    const seedsAfterTypeFilter = new Set(
      [...seedNodeIds].filter(id => {
        const node = this.allNodes.find(n => n.id === id);
        return node && state.allowedNodeTypes.includes(node.node_type);
      })
    );
    
    console.log(`Seed nodes after type filter: ${seedNodeIds.size} → ${seedsAfterTypeFilter.size}`);
    
    // But keep all expanded nodes regardless of type
    candidateNodeIds = new Set(
      [...candidateNodeIds].filter(id => 
        seedsAfterTypeFilter.has(id) || !seedNodeIds.has(id)
      )
    );
    
    console.log(`After applying type filter to seeds only: ${candidateNodeIds.size} nodes`);
  } else {
    console.log('No node type filter applied');
  }

  // Step 3: Build graph with ALL candidate nodes (don't truncate yet)
  console.log(`📊 Total candidate nodes: ${candidateNodeIds.size}`);

  // Create Map for O(1) lookup
  const candidateNodeMap = new Map<string, GraphNode>();
  this.allNodes.forEach(n => {
    if (candidateNodeIds.has(n.id)) {
      candidateNodeMap.set(n.id, n);
    }
  });

  const candidateNodes = Array.from(candidateNodeMap.values());

  // Step 4: Filter links (only between candidate nodes)
  const candidateLinks = this.allLinks.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    const edgeTypeMatch = state.allowedEdgeTypes.length === 0 || 
                         state.allowedEdgeTypes.includes(link.edge_type);
    
    return edgeTypeMatch && candidateNodeMap.has(sourceId) && candidateNodeMap.has(targetId);
  });

  console.log(`After edge filtering: ${candidateNodes.length} nodes, ${candidateLinks.length} links`);

  // Step 5: Remove isolated nodes (nodes with no edges)
  const nodesWithEdges = new Set<string>();
  candidateLinks.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    nodesWithEdges.add(sourceId);
    nodesWithEdges.add(targetId);
  });

  const connectedNodeIds = new Set(
    candidateNodes.filter(n => nodesWithEdges.has(n.id)).map(n => n.id)
  );

  console.log(`After removing isolates: ${connectedNodeIds.size} connected nodes`);
  console.log(`Removed ${candidateNodes.length - connectedNodeIds.size} isolated nodes`);

// Step 6: NOW apply node cap to connected nodes only
const totalMatches = connectedNodeIds.size;
const truncated = totalMatches > state.maxTotalNodes;

console.log('=== Node Ranking Decision ===');
console.log('Connected nodes:', totalMatches);
console.log('Max allowed:', state.maxTotalNodes);
console.log('Will truncate?', truncated);
console.log('Node ranking mode:', nodeRankingMode);

let finalNodeIds: Set<string>;

if (truncated) {
  if (nodeRankingMode === 'subgraph') {
    // SUBGRAPH MODE: Rank by degree in filtered candidate graph
    const nodeDegrees = new Map<string, number>();
    
    candidateLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
      nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
    });
    
    const topNodes = Array.from(connectedNodeIds)
      .filter(nodeId => nodeDegrees.has(nodeId))
      .sort((a, b) => (nodeDegrees.get(b) || 0) - (nodeDegrees.get(a) || 0))
      .slice(0, state.maxTotalNodes);
    
    finalNodeIds = new Set(topNodes);
    console.log(`🔝 Selected top ${finalNodeIds.size} nodes by SUBGRAPH degree`);
    
  } else {
    // GLOBAL MODE: Rank by degree in full graph (current behavior)
    finalNodeIds = new Set(this.selectTopNodesByDegree(connectedNodeIds, state.maxTotalNodes));
    console.log(`🔝 Selected top ${finalNodeIds.size} nodes by GLOBAL degree`);
  }
} else {
  finalNodeIds = connectedNodeIds;
}

console.log(`Final node count after cap: ${finalNodeIds.size} (truncated: ${truncated}, max: ${state.maxTotalNodes})`);


  // Step 7: Build final nodes and links with capped set
  const selectedNodeMap = new Map<string, GraphNode>();
  this.allNodes.forEach(n => {
    if (finalNodeIds.has(n.id)) {
      selectedNodeMap.set(n.id, n);
    }
  });

  const nodes = Array.from(selectedNodeMap.values());

  const links = candidateLinks.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return selectedNodeMap.has(sourceId) && selectedNodeMap.has(targetId);
  });

  console.log(`Built graph with ${nodes.length} nodes and ${links.length} links`);
  console.log('=== Checking properties in final nodes ===');
  console.log('Sample final node:', nodes[0]);
  console.log('Does it have properties?', (nodes[0] as any)?.properties);

  // Step 8: Compute colors by node type and degree
  console.log('🎨 Computing colors for bottom-up graph...');

  const colorStart = performance.now();

  // Compute degree (number of connections) for each node
  const nodeDegree = new Map<string, number>();
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    nodeDegree.set(sourceId, (nodeDegree.get(sourceId) || 0) + 1);
    nodeDegree.set(targetId, (nodeDegree.get(targetId) || 0) + 1);
  });

  // Set val to degree for each node
  nodes.forEach(node => {
    node.val = nodeDegree.get(node.id) || 1;
    node.totalVal = node.val;
  });

  // Find max degree for scaling
  const maxVal = Math.max(...nodes.map(n => n.val), 1);

  // Create strength function (0 to 1 based on connections)
  const strength = (v: number) => v / maxVal;

  // Use D3 color scales matching NetworkGraph exactly
  const sectionColorScale = (t: number) => {
    const r1 = 0x9B, g1 = 0x96, b1 = 0xC9;
    const r2 = 0x41, g2 = 0x37, b2 = 0x8F;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const entityColorScale = (t: number) => {
    const r1 = 0xF9, g1 = 0xD9, b1 = 0x9B;
    const r2 = 0xF0, g2 = 0xA7, b2 = 0x34;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const conceptColorScale = (t: number) => {
    const r1 = 0xE8, g1 = 0xB3, b1 = 0xE3;
    const r2 = 0x9C, g2 = 0x33, b2 = 0x91;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Apply colors to each node based on type and degree strength
  nodes.forEach(node => {
    const t = strength(node.val);
    let color: string;

    if (node.node_type === 'section' || node.node_type === 'index') {
      color = sectionColorScale(t);
    } else if (node.node_type === 'entity') {
      color = entityColorScale(t);
    } else if (node.node_type === 'concept') {
      color = conceptColorScale(t);
    } else {
      color = '#AFBBE8'; // steel
    }

    node.color = color;
    node.baseColor = color;
  });

  console.log(`⏱️ Step 8 (color computation): ${(performance.now() - colorStart).toFixed(2)}ms`);
  console.log('🎨 Color computation complete. Sample colored nodes:');

  console.log(nodes.slice(0, 5).map(n => ({
    id: n.id,
    name: n.name,
    type: n.node_type,
    degree: n.val,
    color: n.color
  })));

  console.log(`⏱️ TOTAL buildNetwork time: ${(performance.now() - startTime).toFixed(2)}ms`);

  return {
    nodes: nodes,
    links,
    truncated: truncated,
    matchedCount: totalMatches
  };
}

/**
 * Select top N nodes by degree (number of connections)
 * This maintains graph connectivity when applying node caps
 */
private selectTopNodesByDegree(nodeIds: Set<string>, maxNodes: number): string[] {
  const nodeDegrees = new Map<string, number>();
  
  // Count connections for each candidate node
  nodeIds.forEach(nodeId => {
    const neighbors = this.adjacencyMap.get(nodeId) || [];
    nodeDegrees.set(nodeId, neighbors.length);
  });
  
  // Sort by degree descending and take top N
  const result = Array.from(nodeDegrees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNodes)
    .map(([nodeId]) => nodeId);
  
  console.log(`🔝 selectTopNodesByDegree: requested ${maxNodes}, returning ${result.length}`);
  
  return result;
}
}  // ← This closing brace ends the NetworkBuilder class

