import React, { useEffect, useState, useCallback, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Box, CircularProgress, Typography, Paper, Button, List, ListItem, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
  type: 'summary' | 'user_question' | 'category' | 'user_question_group' | 'pdf_file'; // ai_messageはノードとして表示しない
  summary_id?: number;
  question_id?: string; // 質問ノード用
  ai_answer?: string; // 質問ノード用
  ai_answer_summary?: string; // NEW FIELD: 要約されたAI回答
  parent_summary_id?: number; // NEW FIELD
  question_created_at?: string; // NEW FIELD
  summary_created_at?: string; // NEW FIELD
  category?: string; // NEW FIELD: Add category to GraphNode
  original_summary_id?: number; // NEW FIELD: 質問が紐づく元の要約ID
  grouped_question_ids?: string[]; // NEW FIELD: 統合された質問ノードのIDリスト
  original_questions_details?: { id: string; label: string; question_id?: string; ai_answer?: string; ai_answer_summary?: string }[]; // NEW FIELD: 統合された質問の詳細
  username?: string; // NEW FIELD: 質問ノード用に追加
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
  const cyRef = useRef<cytoscape.Core | null>(null); // Cytoscape.js インスタンスを保存 (useRefを使用)
  const [expandedGroupNodes, setExpandedGroupNodes] = useState<{ [key: string]: boolean }>({}); // NEW: 展開状態を管理
  const [teams, setTeams] = useState<any[]>([]); // NEW: ユーザーが所属するチームのリスト
  const [selectedFilter, setSelectedFilter] = useState<{ type: 'personal' | 'team' | 'all', teamId?: number }>({ type: 'all' }); // NEW: 選択されたフィルター

  useEffect(() => {
    return () => {
      cyRef.current = null;
    };
  }, []);

  const fetchTeams = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/users/me/teams`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTeams(data);
    } catch (e: any) {
      console.error("Failed to fetch teams:", e.message);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchTeams();
    }
  }, [authToken, fetchTeams]);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/api/summary-tree-graph`;
      const params = new URLSearchParams();

      if (selectedFilter.type === 'personal') {
        params.append('filter_type', 'personal');
      } else if (selectedFilter.type === 'team' && selectedFilter.teamId) {
        params.append('filter_type', 'team');
        params.append('team_id', selectedFilter.teamId.toString());
      }
      // If selectedFilter.type is 'all', no params are added, which defaults to all accessible summaries

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
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
  }, [authToken, selectedFilter]);

  useEffect(() => {
    if (authToken) {
      fetchGraphData();
    }
  }, [authToken, fetchGraphData]);

  const [processedElements, setProcessedElements] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const relayoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!graphData) return;

    const elementsWithDepth: any[] = [];
    const nodeToUltimateRootMap = new Map<string, string>(); // Maps node ID to its ultimate root ID (pdf_file or root summary)
    const nodeToDepthMap = new Map<string, number>(); // Maps node ID to its calculated depth
    const directParentMap = new Map<string, string>(); // Maps child ID to its direct parent ID (summary or pdf_file)

    // First pass: Identify PDF roots and direct parent-child relationships
    graphData.nodes.forEach(node => {
      if (node.type === 'pdf_file') {
        nodeToUltimateRootMap.set(node.id, node.id); // PDF files are their own ultimate root
        nodeToDepthMap.set(node.id, 0); // PDF files are at depth 0
      }
    });

    graphData.links.forEach(link => {
      if (link.type === 'pdf_summary_link') {
        directParentMap.set(link.target, link.source); // Summary linked to PDF
      } else if (link.type === 'parent_summary_link') {
        directParentMap.set(link.target, link.source); // Child summary linked to parent summary
      }
    });

    // Second pass: Trace ultimate roots for all summary nodes
    graphData.nodes.forEach(node => {
      if (node.type === 'summary') {
        let currentId: string | undefined = node.id;
        let path: string[] = []; // To detect cycles
        let ultimateRootId: string | undefined = undefined;

        // Try to find an already established ultimate root (e.g., a PDF file)
        if (nodeToUltimateRootMap.has(currentId)) {
          ultimateRootId = nodeToUltimateRootMap.get(currentId);
        } else {
          // Traverse up the parent chain
          while (currentId && !nodeToUltimateRootMap.has(currentId) && !path.includes(currentId)) {
            path.push(currentId);
            const parentId = directParentMap.get(currentId);
            if (parentId) {
              currentId = parentId;
            } else {
              // No parent found, this summary is a root itself
              ultimateRootId = node.id;
              break;
            }
          }

          if (currentId && nodeToUltimateRootMap.has(currentId)) {
            ultimateRootId = nodeToUltimateRootMap.get(currentId);
          } else if (currentId && !ultimateRootId) {
            // If we reached a node that was already processed as an ultimate root
            ultimateRootId = currentId;
          }
        }

        if (ultimateRootId) {
          nodeToUltimateRootMap.set(node.id, ultimateRootId);
        } else {
          // Fallback: if no ultimate root found, the summary itself is the root
          nodeToUltimateRootMap.set(node.id, node.id);
        }
      }
    });

    // Third pass: Calculate depths for all nodes based on their ultimate root or direct parent
    graphData.nodes.forEach(node => {
      if (node.type === 'pdf_file') {
        nodeToDepthMap.set(node.id, 0);
      } else if (node.type === 'summary') {
        let currentId = node.id;
        let depth = 0;
        let path: string[] = []; // To detect cycles

        while (currentId && nodeToUltimateRootMap.get(currentId) !== currentId && !path.includes(currentId)) {
          path.push(currentId);
          const parentId = directParentMap.get(currentId);
          if (parentId) {
            currentId = parentId;
            depth++;
          } else {
            break;
          }
        }
        nodeToDepthMap.set(node.id, depth);
      }
      // For category, user_question, user_question_group, their depth will be relative to their direct parent summary/category
      // We will set a default depth for them if their parent's depth is not yet calculated or they are standalone
    });

    // Now, construct elementsWithDepth using the calculated depths
    graphData.nodes.forEach(node => {
      let depth = nodeToDepthMap.get(node.id);

      if (node.type === 'category') {
        // Find its parent summary to determine its depth
        const parentSummaryLink = graphData.links.find(link => link.target === node.id && link.type === 'summary_category_link');
        if (parentSummaryLink && nodeToDepthMap.has(parentSummaryLink.source)) {
          depth = nodeToDepthMap.get(parentSummaryLink.source)! + 1;
        } else {
          depth = depth === undefined ? 1 : depth; // Default to 1 if no parent or depth not set
        }
      } else if (node.type === 'user_question' || node.type === 'user_question_group') {
        // Find its parent category or summary to determine its depth
        const parentLink = graphData.links.find(link => link.target === node.id && (link.type === 'category_question_link' || link.type === 'summary_question_link'));
        if (parentLink && nodeToDepthMap.has(parentLink.source)) {
          depth = nodeToDepthMap.get(parentLink.source)! + 1;
        } else {
          depth = depth === undefined ? 2 : depth; // Default to 2 if no parent or depth not set
        }
      } else if (depth === undefined) {
        depth = 0; // Default for any other unhandled node types
      }

      let nodeLabel = node.label;
      if ((node.type === 'user_question' || node.type === 'user_question_group') && node.username) {
        nodeLabel = `${node.username}: ${node.label}`;
      }

      elementsWithDepth.push({
        data: { ...node, depth: depth, label: nodeLabel },
        classes: node.type,
      });
    });

    // Add links
    graphData.links.forEach(link => {
      const sourceNode = graphData.nodes.find(n => n.id === link.source);
      const targetNode = graphData.nodes.find(n => n.id === link.target);
      try {
        if (sourceNode?.type === 'summary' && targetNode?.type === 'category') {
          elementsWithDepth.push({
            data: { source: link.source, target: link.target, type: 'summary_category_link' },
            classes: 'summary_category_link',
          });
        } else if (sourceNode?.type === 'category' && (targetNode?.type === 'user_question' || targetNode?.type === 'user_question_group')) {
          elementsWithDepth.push({
            data: { source: link.source, target: link.target, type: 'category_question_link' },
            classes: 'category_question_link',
          });
        } else if (link.type === 'similarity_link') {
          const effectiveSourceId = nodeToUltimateRootMap.get(link.source) || link.source;
          const effectiveTargetId = nodeToUltimateRootMap.get(link.target) || link.target;
          elementsWithDepth.push({
            data: { source: effectiveSourceId, target: effectiveTargetId, type: 'similarity_link' },
            classes: 'similarity_link',
          });
        } else if (link.type === 'pdf_summary_link') {
          elementsWithDepth.push({
            data: { source: link.source, target: link.target, type: 'pdf_summary_link' },
            classes: 'pdf_summary_link',
          });
        } else if (sourceNode?.type === 'summary' && targetNode?.type === 'summary') {
          // Create parent_summary_link for all direct summary parent-child relationships
          elementsWithDepth.push({
            data: { source: link.source, target: link.target, type: 'parent_summary_link' },
            classes: 'parent_summary_link',
          });
        } else if ((targetNode?.type === 'user_question' || targetNode?.type === 'user_question_group') && targetNode.original_summary_id) {
          const originalSummaryId = `summary_${targetNode.original_summary_id}`;
          elementsWithDepth.push({
            data: { source: originalSummaryId, target: link.target, type: 'summary_question_link' },
            classes: 'summary_question_link',
          });
        }
      } catch {}
    });

    setProcessedElements(elementsWithDepth);
  }, [graphData]);

  // Decide layout dynamically based on graph size/content
  const computeLayout = useCallback((nodeCount: number) => {
    if (nodeCount > 120) {
      // For large graphs, use dagre (layered) to reduce overlaps and edge crossings
      return {
        name: 'dagre',
        rankDir: 'LR',
        fit: true,
        padding: 50,
        rankSep: 120,
        nodeSep: 40,
        edgeSep: 20,
        animate: true,
        animationDuration: 300,
      } as any;
    }
    // Default: fcose with stronger repulsion and tiling to avoid overlaps
    return {
      name: 'fcose',
      quality: 'proof',
      animate: true,
      animationDuration: 300,
      animationEasing: 'ease-out',
      fit: true,
      padding: 50,
      nodeDimensionsIncludeLabels: true,
      tile: true,
      tilingPaddingVertical: 24,
      tilingPaddingHorizontal: 24,
      gravity: 0.25,
      numIter: 3000,
      nodeRepulsion: 45000,
      idealEdgeLength: 140,
      edgeElasticity: 0.45,
      nestingFactor: 0.8,
      incremental: true,
    } as any;
  }, []);

  const runAutoLayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const nodeCount = cy.nodes().length;
    const layout = computeLayout(nodeCount);
    cy.layout(layout).run();
    // After layout, ensure content fits viewport with some padding
    cy.fit(undefined, 40);
  }, [computeLayout]);

  // Re-run layout when processed elements change
  useEffect(() => {
    if (!cyRef.current) return;
    if (relayoutTimerRef.current) {
      window.clearTimeout(relayoutTimerRef.current);
    }
    relayoutTimerRef.current = window.setTimeout(() => {
      runAutoLayout();
    }, 150);

    return () => {
      if (relayoutTimerRef.current) {
        window.clearTimeout(relayoutTimerRef.current);
      }
    };
  }, [processedElements, runAutoLayout]);

  // Re-run layout and fit on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
        if (relayoutTimerRef.current) window.clearTimeout(relayoutTimerRef.current);
        relayoutTimerRef.current = window.setTimeout(() => {
          runAutoLayout();
        }, 120);
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (relayoutTimerRef.current) {
        window.clearTimeout(relayoutTimerRef.current);
      }
    };
  }, [runAutoLayout]);

  const layout = React.useMemo(() => computeLayout(processedElements.length || 0), [computeLayout, processedElements.length]);

  useEffect(() => {
    if (!cyRef.current) return; // cyRef.currentがnullの場合は何もしない

    // processedElementsが空の場合はレイアウトを実行しない
    if (processedElements.length === 0) {
      // 既存のノードやエッジを全て削除する
      cyRef.current.remove(cyRef.current.elements()); // cyRef.current を参照
      return;
    }

    // cy.layout() の呼び出しを try-catch で囲む
    try {
      cyRef.current.nodes().ungrabify(); // cyRef.current を参照
      cyRef.current.layout(layout).run(); // cyRef.current を参照
    } catch (e) {
      console.error("Error running layout:", e);
      // エラーが発生した場合の追加の処理（例: レイアウトをリセットするなど）
    }

    // クリーンアップ関数から cyRef.current.destroy() を削除
  }, [processedElements, layout]); // 依存配列も cyRef.current に変更

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
      selector: '.pdf_file',
      style: {
        'background-color': '#f44336', // Red color for PDF files
        'shape': 'rectangle', // PDFノードは四角形に
        'font-size': '14px',
        'text-max-width': '150px',
        'width': 'mapData(label.length, 1, 50, 80, 200)', // Dynamic width based on label length
        'height': 'mapData(label.length, 1, 50, 40, 80)',
        'border-color': '#ef9a9a',
        'shadow-color': '#f44336',
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
    { // NEW: 統合された質問ノードのスタイル
      selector: '.user_question_group',
      style: {
        'background-color': '#ff9800', // Orange
        'border-color': '#ffb74d',
        'shape': 'round-rectangle', // 統合ノードは四角形に
        'text-max-width': '180px', // ラベルが長くなる可能性があるので幅を広げる
        'width': 'mapData(label.length, 1, 50, 100, 250)', // Dynamic width based on label length
        'height': 'mapData(label.length, 1, 50, 50, 100)', // Dynamic height
        'locked': true, // NEW: ノードを固定する
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
      selector: '.pdf_summary_link', // NEW: PDFから要約へのリンクスタイル
      style: {
        'line-color': '#f44336', // PDFノードの色に合わせる
        'target-arrow-color': '#f44336',
        'line-style': 'solid',
        'width': 2,
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
    {
      selector: '.group_child_link',
      style: {
        'line-color': '#a0a0a0',
        'target-arrow-color': '#a0a0a0',
        'line-style': 'dotted',
        'width': 1,
        'opacity': 0.5,
      },
    },
  ];
  
  const handleNodeClick = useCallback((event: any) => { // useCallback でラップ
    const node = event.target;
    if (node.isNode()) {
      const nodeData = node.data();
      setSelectedNode(nodeData); // 右側の詳細パネルに表示

      if (nodeData.type === 'user_question_group' && cyRef.current) { // cyRef.current を参照
        const isExpanded = expandedGroupNodes[nodeData.id];
        const newExpandedGroupNodes = { ...expandedGroupNodes };

        const affectedElements = cyRef.current!.collection(); // cyRef.current が null でないことをアサーション
        affectedElements.merge(cyRef.current!.$(`#${nodeData.id}`)); // cyRef.current が null でないことをアサーション

        if (isExpanded) {
          // 折りたたむ場合: 子ノードとリンクを削除
          nodeData.original_questions_details?.forEach((originalQuestion: any) => {
            const safeOriginalQuestionId = originalQuestion.id.replace(/[^a-zA-Z0-9-_]/g, '_'); // 英数字、ハイフン、アンダースコア以外をアンダースコアに置換
            const childNodeId = `child_question_${nodeData.id}_${safeOriginalQuestionId}`;
            const childNode = cyRef.current!.$(`#${childNodeId}`);
            if (childNode.length > 0) {
              cyRef.current!.remove(childNode); // 子ノードを削除
            }
            const edge = cyRef.current!.$(`edge[source='${nodeData.id}'][target='${childNodeId}']`);
            if (edge.length > 0) {
              cyRef.current!.remove(edge); // エッジを削除
            }
          });
          newExpandedGroupNodes[nodeData.id] = false;
        } else {
          // 展開する場合: 子ノードとリンクを追加
          const newElements: any[] = [];
          nodeData.original_questions_details?.forEach((originalQuestion: any) => {
            const safeOriginalQuestionId = originalQuestion.id.replace(/[^a-zA-Z0-9-_]/g, '_'); // 英数字、ハイフン、アンダースコア以外をアンダースコアに置換
            const childNodeId = `child_question_${nodeData.id}_${safeOriginalQuestionId}`;
            let childNodeLabel = originalQuestion.label;
            if (originalQuestion.username) { // Assuming originalQuestion also has a username
              childNodeLabel = `${originalQuestion.username}: ${originalQuestion.label}`;
            }
            newElements.push({
              data: {
                id: childNodeId,
                label: childNodeLabel,
                type: 'user_question', // 子ノードはuser_questionタイプ
                summary_id: nodeData.summary_id,
                question_id: originalQuestion.question_id,
                ai_answer: originalQuestion.ai_answer, // 必要であれば元の質問のAI回答も渡す
                ai_answer_summary: originalQuestion.ai_answer_summary,
                category: nodeData.category,
                parent_group_id: nodeData.id, // 親グループノードのIDを保持
                locked: true, // NEW: 子ノードも固定する
                username: originalQuestion.username, // Pass username to child node
              },
              classes: 'user_question',
            });
            newElements.push({
              data: {
                id: `${nodeData.id}-${childNodeId}-link`,
                source: nodeData.id,
                target: childNodeId,
                type: 'group_child_link',
                directed: true,
              },
              classes: 'group_child_link',
            });
            affectedElements.merge(cyRef.current!.$(`#${childNodeId}`)); // 追加対象の子ノードもaffectedElementsに含める
          });
          cyRef.current!.add(newElements); // cyRef.current を参照
          newExpandedGroupNodes[nodeData.id] = true;
        }
        setExpandedGroupNodes(newExpandedGroupNodes);
        // cyRef.current はここで null でないことが保証されている
        // 影響を受ける要素とその周辺の要素に対してレイアウトを適用
        affectedElements.union(affectedElements.neighborhood()).layout({
          ...layout,
          // fit: false, // 部分的なレイアウトなのでフィットはしない (型エラーのため削除)
        }).run();
      }
    }
  }, [expandedGroupNodes, layout]); // 依存配列に expandedGroupNodes と layout を追加

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // イベントリスナーを登録
    cy.on('tap', 'node', handleNodeClick);
    const scheduleRelayout = () => {
      if (relayoutTimerRef.current) window.clearTimeout(relayoutTimerRef.current);
      relayoutTimerRef.current = window.setTimeout(() => {
        runAutoLayout();
      }, 100);
    };
    cy.on('add remove data', scheduleRelayout);

    // クリーンアップ関数でリスナーを解除
    return () => {
      cy.removeListener('tap', 'node', handleNodeClick);
      cy.removeListener('add remove data', scheduleRelayout);
      if (relayoutTimerRef.current) {
        window.clearTimeout(relayoutTimerRef.current);
      }
    };
  }, [handleNodeClick, runAutoLayout]); // 依存配列にコールバック関数を含める

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
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', p: 2, flexWrap: 'nowrap' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1, pr: 2 }}>
        <Box ref={containerRef} sx={{ flexGrow: 1, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 2, alignItems: 'center', p: 1, borderRadius: '4px' }}>
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel id="graph-filter-label">表示フィルター</InputLabel>
              <Select
                labelId="graph-filter-label"
                id="graph-filter-select"
                value={selectedFilter.type}
                label="表示フィルター"
                onChange={(e) => {
                  const newFilterType = e.target.value as 'personal' | 'team' | 'all';
                  if (newFilterType === 'team' && teams.length > 0) {
                    setSelectedFilter({ type: newFilterType, teamId: teams[0].id });
                  } else {
                    setSelectedFilter({ type: newFilterType });
                  }
                }}
              >
                <MenuItem value="all">全て</MenuItem>
                <MenuItem value="personal">個人</MenuItem>
                <MenuItem value="team">チーム</MenuItem>
              </Select>
            </FormControl>

            {selectedFilter.type === 'team' && (
              <FormControl sx={{ minWidth: 180 }} size="small">
                <InputLabel id="team-select-label">チームを選択</InputLabel>
                <Select
                  labelId="team-select-label"
                  id="team-select"
                  value={selectedFilter.teamId || ''}
                  label="チームを選択"
                  onChange={(e) => {
                    setSelectedFilter({ type: 'team', teamId: Number(e.target.value) });
                  }}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* NEW: Legend */}
          <Paper elevation={3} sx={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10, p: 1, borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
            <Typography variant="subtitle2" gutterBottom>凡例</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#f44336', borderRadius: '2px', mr: 1 }} />
              <Typography variant="body2">PDFファイル</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#00bcd4', borderRadius: '2px', mr: 1 }} />
              <Typography variant="body2">要約</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#4caf50', borderRadius: '2px', mr: 1 }} />
              <Typography variant="body2">質問</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#ff9800', borderRadius: '2px', mr: 1 }} />
              <Typography variant="body2">統合された質問</Typography>
            </Box>
          </Paper>
          <CytoscapeComponent
          key={`graph-component-${selectedFilter.type}-${selectedFilter.teamId || ''}`}

          elements={processedElements}
          stylesheet={style}
          layout={layout}
          cy={(cyInstance) => {
            if (!cyInstance) return; // cyInstanceがnullの場合は何もしない

            // まず、cyRef.currentを新しいインスタンスに更新
            cyRef.current = cyInstance;

            // Initial layout after mount
            runAutoLayout();
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
      {selectedNode && (
        <Paper elevation={3} sx={{ width: 300, p: 2, overflowY: 'auto', flexShrink: 0 }}>
          <Typography variant="h6" gutterBottom>ノード詳細</Typography>
          <Typography variant="subtitle1">ID: {selectedNode.id}</Typography>
          <Typography variant="subtitle1">タイプ: {selectedNode.type}</Typography>
          {selectedNode.type === 'category' && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>カテゴリ名:</strong> {selectedNode.label}
            </Typography>
          )}
          {selectedNode.type === 'pdf_file' && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>ファイル名:</strong> {selectedNode.label}
            </Typography>
          )}
          {selectedNode.type !== 'category' && selectedNode.type !== 'pdf_file' && (
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
          {selectedNode.type === 'user_question_group' && selectedNode.original_questions_details && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">統合された質問:</Typography>
              <List dense>
                {selectedNode.original_questions_details.map((originalQuestion, index) => (
                  <ListItem key={index} sx={{ flexDirection: 'row', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      質問: {originalQuestion.label}
                    </Typography>
                    {originalQuestion.ai_answer && (
                      <Box sx={{ mt: 0.5, width: '100%' }}>
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                          AIの回答:
                        </Typography>
                        <Box className="markdown-content">
                          <ReactMarkdown>
                            {originalQuestion.ai_answer_summary || originalQuestion.ai_answer}
                          </ReactMarkdown>
                        </Box>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
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
              {/* NEW: Display child summaries */}
              <Typography variant="subtitle2" sx={{ mt: 2 }}>子要約:</Typography>
              <List dense>
                {graphData.nodes
                  .filter(node => node.type === 'summary' && node.parent_summary_id === selectedNode.summary_id)
                  .map((childSummaryNode, index) => (
                    <ListItem key={index}>
                      <Typography variant="body2">- {childSummaryNode.label} (ID: {childSummaryNode.summary_id})</Typography>
                    </ListItem>
                  ))}
              </List>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  </Box>
)};

export default SummaryTreeGraph;
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
