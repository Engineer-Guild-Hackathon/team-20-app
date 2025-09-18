import React, { useEffect, useState, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Box, CircularProgress, Typography, Paper, Button, List, ListItem } from '@mui/material';
import { useAuth } from '../AuthContext';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import ReactMarkdown from 'react-markdown';

cytoscape.use(dagre);
cytoscape.use(fcose);

interface GraphNode {
  id: string;
  label: string;
  type: 'summary' | 'user_question' | 'category'; // ai_messageはノードとして表示しない
  summary_id?: number;
  question_id?: string; // 質問ノード用
  ai_answer?: string; // 質問ノード用
  ai_answer_summary?: string; // NEW FIELD: 要約されたAI回答
  parent_summary_id?: number; // NEW FIELD
  question_created_at?: string; // NEW FIELD
  summary_created_at?: string; // NEW FIELD
  category?: string; // NEW FIELD: Add category to GraphNode
  original_summary_id?: number; // NEW FIELD: 質問が紐づく元の要約ID
}

interface GraphLink {
  source: string;
  target: string;
  type?: string; // NEW FIELD: Add type to GraphLink
  directed?: boolean; // NEW FIELD: エッジの方向性を示す
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const SummaryTreeGraph: React.FC = () => {
  const { authToken } = useAuth();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isSummarized, setIsSummarized] = useState<boolean>(true); // NEW: 要約表示/元の回答表示を切り替えるstate
  const [cy, setCy] = useState<cytoscape.Core | null>(null); // Cytoscape.js インスタンスを保存

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/summary-tree-graph', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: GraphData = await response.json();
      setGraphData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchGraphData();
    }
  }, [authToken, fetchGraphData]);

  const [processedElements, setProcessedElements] = useState<any[]>([]);

  useEffect(() => {
    if (!graphData) return;

    console.log("--- Debugging SummaryTreeGraph --- ");
    console.log("Initial graphData:", graphData);

    const elementsWithDepth: any[] = [];
    const depthMap = new Map<string, number>();

    // Initialize summary nodes with depth 0
    graphData.nodes.forEach(node => {
      if (node.type === 'summary') {
        depthMap.set(node.id, 0);
        elementsWithDepth.push({
          data: { ...node, depth: 0 },
          classes: node.type,
        });
      }
    });

    // Build adjacency list for easy traversal
    const adj: { [key: string]: string[] } = {};
    graphData.links.forEach(link => {
      if (!adj[link.source]) adj[link.source] = [];
      adj[link.source].push(link.target);
    });

    // Perform BFS to calculate depth for category and question nodes
    const queue: string[] = graphData.nodes.filter(n => n.type === 'summary').map(n => n.id);
    let head = 0;

    while(head < queue.length) {
      const currentId = queue[head++];
      const currentDepth = depthMap.get(currentId)!;

      if (adj[currentId]) {
        adj[currentId].forEach(neighborId => {
          if (!depthMap.has(neighborId)) {
            depthMap.set(neighborId, currentDepth + 1);
            queue.push(neighborId);
          }
        });
      }
    }

    // Add category and question nodes with calculated depth
    graphData.nodes.forEach(node => {
      if (node.type === 'category') {
        const depth = depthMap.get(node.id) || 1; // Default to 1 if not found
        elementsWithDepth.push({
          data: { ...node, depth: depth },
          classes: node.type,
        });
      } else if (node.type === 'user_question') {
        const depth = depthMap.get(node.id) || 2; // Default to 2 if not found
        elementsWithDepth.push({
          data: { ...node, depth: depth },
          classes: `${node.type} ${node.category ? `category-${node.category}` : ''}`, // カテゴリクラスを追加
        });
      }
    });

    // Add links
    graphData.links.forEach(link => {
      const sourceNode = graphData.nodes.find(n => n.id === link.source);
      const targetNode = graphData.nodes.find(n => n.id === link.target);

      if (sourceNode?.type === 'summary' && targetNode?.type === 'category') {
        elementsWithDepth.push({
          data: { source: link.source, target: link.target, type: 'summary_category_link' },
          classes: 'summary_category_link',
        });
      } else if (sourceNode?.type === 'category' && targetNode?.type === 'user_question') {
        elementsWithDepth.push({
          data: { source: link.source, target: link.target, type: 'category_question_link' },
          classes: 'category_question_link',
        });
      } else if (link.type === 'similarity_link') { // NEW: 類似度リンクを追加
        elementsWithDepth.push({
          data: { source: link.source, target: link.target, type: 'similarity_link' },
          classes: 'similarity_link',
        });
      } else if (sourceNode?.type === 'summary' && targetNode?.type === 'summary') {
        elementsWithDepth.push({
          data: { source: link.source, target: link.target, type: 'parent_summary_link' },
          classes: 'parent_summary_link',
        });
      } else if (targetNode?.type === 'user_question' && targetNode.original_summary_id) { // 質問ノードがoriginal_summary_idを持つ場合
        elementsWithDepth.push({
          data: { source: `summary-${targetNode.original_summary_id}`, target: link.target, type: 'summary_question_link' },
          classes: 'summary_question_link',
        });
      }
    });

    setProcessedElements(elementsWithDepth);
  }, [graphData]);

  const layout = React.useMemo(() => ({
    name: 'fcose',
    quality: 'proof', // 'draft', 'default', 'proof'
    animate: false, // whether to enable animation when the layout is running
    animationDuration: 500, // duration of animation in ms if enabled
    animationEasing: 'ease-out', // easing of animation if enabled
    fit: true, // whether to fit the viewport to the graph
    padding: 50, // the padding on the sides of the graph
    nodeDimensionsIncludeLabels: true, // whether to include labels in node dimensions
    tile: true, // whether to enable tiling
    tilingPaddingVertical: 10, // vertical padding for tiling
    tilingPaddingHorizontal: 10, // horizontal padding for tiling
    gravity: 0.5, // gravity force (constant) for all nodes
    numIter: 2500, // maximum number of iterations to perform
    idealEdgeLength: 100, // ideal (user-specified) edge length
    edgeElasticity: 0.45, // elasticity constant for the edge force
    nestingFactor: 0.1, // nesting factor (multiplier) for the inter-graph force
    gravityRange: 3.8, // range of the gravity force
    gravityCompound: 1.0, // gravity force (constant) for compound nodes
    gravityRoot: 1.0, // gravity force (constant) for the highest level compound nodes
    initialEnergyOnIncremental: 0.3, // initial energy on incremental layout
    // for incremental layouts
    incremental: true, // whether to enable incremental layout
  }), []);

  useEffect(() => {
    if (cy && processedElements.length > 0) {
      cy.nodes().ungrabify(); // ノードをドラッグできないようにする
      cy.layout(layout).run(); // レイアウトを明示的に再実行
    }
  }, [cy, processedElements, layout]);

  const style = [
    {
      selector: 'node',
      style: {
        'background-color': '#444',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#eee',
        'font-size': '10px',
        'text-wrap': 'wrap',
        'text-max-width': '100px',
        'width': 'label',
        'height': 'label',
        'padding': '10px',
        'border-width': 1,
        'border-color': '#555',
        'border-style': 'solid',
        'shadow-blur': 5,
        'shadow-offset-x': 2,
        'shadow-offset-y': 2,
        'shadow-color': '#222',
        'shadow-opacity': 0.5,
        'shape': 'ellipse', // すべてのノードを楕円形に
        'grabbable': false, // ノードを移動できないようにする
      },
    },
    {
      selector: '.summary',
      style: {
        'background-color': '#00bcd4', // Primary color from theme
        'shape': 'ellipse', // 要約ノードも楕円形に
        'font-size': '14px',
        'text-max-width': '150px',
        'width': 'mapData(label.length, 1, 50, 80, 200)', // Dynamic width based on label length
        'height': 'mapData(label.length, 1, 50, 40, 80)', // Dynamic height
        'border-color': '#00e5ff',
        'shadow-color': '#00bcd4',
      },
    },
    {
      selector: '.user_question',
      style: {
        'background-color': '#4caf50', // Green
        'border-color': '#81c784',
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#888',
        'target-arrow-color': '#888',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 40, // エッジの重なりを減らすために追加
        'opacity': 0.7,
        'arrow-scale': 1, // 矢印のサイズを調整
      },
    },
    {
      selector: 'edge[directed = false]', // directedがfalseのエッジ
      style: {
        'target-arrow-shape': 'none', // 矢印を表示しない
      },
    },
    {
      selector: '.summary_question_link',
      style: {
        'line-color': '#888',
        'target-arrow-color': '#888',
      },
    },
    {
      selector: '.parent_summary_link',
      style: {
        'line-color': '#00bcd4', // Primary color for parent links
        'target-arrow-color': '#00bcd4',
        'line-style': 'dashed', // Dashed line for parent links
        'width': 3,
      },
    },
    {
      selector: '.similarity_link', // NEW: 類似度リンクのスタイル
      style: {
        'line-color': '#FFD700', // Gold color for similarity links
        'target-arrow-color': '#FFD700',
        'line-style': 'dotted', // Dotted line for similarity links
        'width': 1,
        'opacity': 0.6,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#FFD700', // Gold
        'shadow-color': '#FFD700',
        'shadow-blur': 10,
      },
    },
    {
      selector: 'node:hover',
      style: {
        'shadow-blur': 15,
        'shadow-color': '#fff',
        'cursor': 'pointer',
      },
    },
  ];

  const handleNodeClick = (event: any) => {
    const node = event.target;
    if (node.isNode()) {
      const nodeData = node.data();
      // 非表示対象の質問ノードは選択されても詳細を表示しない
      // hiddenQuestionNodeIdsはuseEffectスコープ内なので、ここでは直接参照できない。
      // そのため、selectedNodeがuser_questionタイプで、かつparent_summary_idを持つsummaryに紐づく場合は詳細を表示しない、というロジックを再構築する必要がある。
      // ただし、elementsWithDepthに追加されていないノードはそもそも選択できないため、このチェックは不要。
      // ここではシンプルに、選択されたノードのデータをセットする。
      setSelectedNode(nodeData);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>グラフデータを読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography color="error" variant="h6">エラー: {error}</Typography>
      </Box>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography variant="h6">表示するグラフデータがありません。</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', p: 2 }}>
      <Box sx={{ flexGrow: 1, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        <CytoscapeComponent
          key="graph-component"
          elements={processedElements}
          stylesheet={style}
          layout={layout}
          cy={(cyInstance) => {
            if (cyInstance) {
              cyInstance.on('tap', 'node', handleNodeClick);
              setCy(cyInstance); // cy インスタンスを state に保存
            }
            return () => {
              if (cyInstance) {
                cyInstance.destroy();
              }
            };
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
      {selectedNode && (
        <Paper elevation={3} sx={{ width: 300, ml: 2, p: 2, overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>ノード詳細</Typography>
          <Typography variant="subtitle1">ID: {selectedNode.id}</Typography>
          <Typography variant="subtitle1">タイプ: {selectedNode.type}</Typography>
          {selectedNode.type === 'category' && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>カテゴリ名:</strong> {selectedNode.label}
            </Typography>
          )}
          {selectedNode.type !== 'category' && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>内容:</strong> {selectedNode.label}
            </Typography>
          )}
          {selectedNode.summary_id && (
            <Typography variant="body2">要約ID: {selectedNode.summary_id}</Typography>
          )}
          {selectedNode.question_id && (
            <Typography variant="body2">質問ID: {selectedNode.question_id}</Typography>
          )}
          {selectedNode.category && (
            <Typography variant="body2">カテゴリ: {selectedNode.category}</Typography>
          )}
          {selectedNode.ai_answer && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">AIの回答:</Typography>
              {selectedNode.ai_answer_summary ? (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setIsSummarized(!isSummarized)}
                    sx={{ mb: 1 }}
                  >
                    {isSummarized ? '元の回答を表示' : '要約を表示'}
                  </Button>
                  <ReactMarkdown>
                    {isSummarized ? selectedNode.ai_answer_summary : selectedNode.ai_answer}
                  </ReactMarkdown>
                </>
              ) : (
                <ReactMarkdown>
                  {selectedNode.ai_answer}
                </ReactMarkdown>
              )}
            </Box>
          )}
          {selectedNode.type === 'summary' && graphData && ( // 要約ノードの場合のみ質問リストを表示
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">関連する質問:</Typography>
              <List dense>
                {graphData.nodes
                  .filter(node => node.type === 'user_question' && node.summary_id === selectedNode.summary_id)
                  .map((questionNode, index) => (
                    <ListItem key={index}>
                      <Typography variant="body2">- {questionNode.label}</Typography>
                    </ListItem>
                  ))}
              </List>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default SummaryTreeGraph;
