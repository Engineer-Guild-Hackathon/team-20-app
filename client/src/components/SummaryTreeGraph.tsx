import React, { useState, useEffect, useCallback } from 'react';
import Tree from 'react-d3-tree';
import { Box, Typography, Paper, CircularProgress, Tooltip, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Message } from './AiAssistant';

interface SummaryTreeNode {
  name: string;
  attributes: {
    id: number;
    summary: string;
    created_at: string;
    user_id: number;
    username: string;
    team_id?: number;
    team_name?: string;
    tags: string;
    chat_history_id?: number;
    original_file_path?: string;
    parent_summary_id?: number;
  };
  children: SummaryTreeNode[];
}

interface SummaryTreeGraphProps {
  onNodeClick: (nodeData: any) => void;
}

// チャット履歴表示用のコンポーネント (SummaryHistory.tsxから流用)
const ChatHistoryDisplay: React.FC<{ chatHistoryId?: number }> = ({ chatHistoryId }) => {
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!chatHistoryId) {
        setChatMessages([]);
        return;
      }

      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('認証情報がありません');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/api/history-contents/${chatHistoryId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('チャット履歴の読み込みに失敗しました');
        }

        const data = await response.json();
        if (data.content) {
          const messages = JSON.parse(data.content);
          setChatMessages(messages);
        } else {
          setChatMessages([]);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setError(err instanceof Error ? err.message : 'チャット履歴の読み込みに失敗しました');
        setChatMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [chatHistoryId]);

  if (loading) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>チャット履歴を読み込み中...</Typography>;
  }

  if (error) {
    return <Typography variant="body2" color="error" sx={{ p: 1 }}>{error}</Typography>;
  }

  if (!chatHistoryId || chatMessages.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>AI Assistant とのチャット履歴はありません。</Typography>;
  }

  return (
    <Box sx={{ maxHeight: '200px', overflowY: 'auto', p: 1, border: '1px solid #ccc', borderRadius: 1 }}>
      {chatMessages.map((msg: Message, index: number) => (
        <Typography key={index} variant="caption" display="block" sx={{ mb: 0.5 }}>
          <strong>{msg.sender === 'user' ? (msg.username || 'You') : 'AI'}:</strong> {msg.text.substring(0, 100)}...
        </Typography>
      ))}
    </Box>
  );
};

const renderCustomNode = ({ nodeDatum, toggleNode, onNodeMouseOver, onNodeMouseOut, onNodeClick }: any) => (
  <g>
    <circle r={15} fill={nodeDatum.children && nodeDatum.children.length > 0 ? "#00bcd4" : "#9e9e9e"} onClick={toggleNode} />
    <text fill="black" strokeWidth="0.5" x="20" y="5" onClick={onNodeClick}>
      {nodeDatum.name}
    </text>
    {nodeDatum.attributes?.tags && nodeDatum.attributes.tags.length > 0 && (
      <text fill="gray" strokeWidth="0.2" x="20" y="20" fontSize="10">
        {nodeDatum.attributes.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean).join(', ')}
      </text>
    )}
    <rect
      x="-15"
      y="-15"
      width="30"
      height="30"
      fill="transparent"
      onMouseOver={() => onNodeMouseOver(nodeDatum)}
      onMouseOut={() => onNodeMouseOut(nodeDatum)}
      onClick={onNodeClick}
    />
  </g>
);

const SummaryTreeGraph: React.FC<SummaryTreeGraphProps> = ({ onNodeClick }) => {
  console.log("SummaryTreeGraph component rendered.");
  const [treeData, setTreeData] = useState<SummaryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SummaryTreeNode | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('');

  useEffect(() => {
    const fetchTreeData = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('認証情報がありません');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/summaries/tree', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error('ツリーデータの取得に失敗しました');
        }
        const data: SummaryTreeNode[] = await response.json();
        console.log("Fetched tree data from API:", data);
        setTreeData(data);
        if (data.length > 0) {
          setSelectedRootId(data[0].attributes.id);
        }
      } catch (err) {
        console.error('Error fetching tree data:', err);
        setError(err instanceof Error ? err.message : 'ツリーデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTreeData();
  }, []);

  const handleNodeMouseOver = useCallback((nodeDatum: SummaryTreeNode) => {
    setHoveredNode(nodeDatum);
  }, []);

  const handleNodeMouseOut = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const handleNodeClick = useCallback((nodeDatum: any) => {
    onNodeClick(nodeDatum.attributes);
  }, [onNodeClick]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const dimensions = node.getBoundingClientRect();
      setTranslate({ x: dimensions.width / 2, y: dimensions.height / 10 });
    }
  }, []);

  const displayedTreeData = selectedRootId
    ? treeData.filter(node => node.attributes.id === selectedRootId)
    : treeData;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>ツリーデータを読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, color: 'error.main' }}>
        <Typography>エラー: {error}</Typography>
        <Button onClick={() => window.location.reload()} variant="outlined" sx={{ mt: 2 }}>再試行</Button>
      </Box>
    );
  }

  if (treeData.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>表示する要約ツリーがありません。</Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 100 }}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 200, bgcolor: 'background.paper' }}>
          <InputLabel>表示するツリーを選択</InputLabel>
          <Select
            value={selectedRootId}
            onChange={(e) => setSelectedRootId(e.target.value as number)}
            label="表示するツリーを選択"
          >
            {treeData.map((node) => (
              <MenuItem key={node.attributes.id} value={node.attributes.id}>
                {node.name} (ID: {node.attributes.id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Tree
        data={displayedTreeData}
        orientation="vertical"
        translate={translate}
        nodeSize={{ x: 350, y: 150 }}
        separation={{ siblings: 2, nonSiblings: 2 }}
        pathFunc="step"
        renderCustomNodeElement={(rd3tProps) =>
          renderCustomNode({
            ...rd3tProps,
            onNodeMouseOver: handleNodeMouseOver,
            onNodeMouseOut: handleNodeMouseOut,
            onNodeClick: handleNodeClick,
          })
        }
        collapsible={true}
        zoomable={true}
        draggable={true}
        initialDepth={100}
        depthFactor={300}
      />
      {hoveredNode && (
        <Tooltip
          open={true}
          title={
            <Paper elevation={3} sx={{ p: 2, maxWidth: 400 }}>
              <Typography variant="h6" gutterBottom>{hoveredNode.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {hoveredNode.attributes.username} - {new Date(hoveredNode.attributes.created_at).toLocaleString()}
              </Typography>
              {hoveredNode.attributes.tags.length > 0 && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  タグ: {hoveredNode.attributes.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean).join(', ')}
                </Typography>
              )}
              {hoveredNode.attributes.original_file_path && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  ファイル: {JSON.parse(hoveredNode.attributes.original_file_path).join(', ')}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 1 }}>
                要約: {hoveredNode.attributes.summary.substring(0, 200)}...
              </Typography>
              {hoveredNode.attributes.chat_history_id && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>AI Assistant チャット履歴 (一部)</Typography>
                  <ChatHistoryDisplay chatHistoryId={hoveredNode.attributes.chat_history_id} />
                </Box>
              )}
            </Paper>
          }
          arrow
          placement="right"
          PopperProps={{
            sx: {
              pointerEvents: 'none',
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default SummaryTreeGraph;