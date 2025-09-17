import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Container, TextField, Button, List, ListItem, ListItemButton, ListItemText, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem as MuiMenuItem, FormControl, InputLabel, Tabs, Tab } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';

interface TeamManagementProps {
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
  onSummaryGeneratedFromTeamUpload?: (summary: string, filename: string, summaryId?: number, tags?: string[], filePath?: string[]) => void;
}

interface Team {
  id: number;
  name: string;
  role: string;
  created_by_user_id: number;
}

interface TeamMember {
  user_id: number;
  username: string;
  role: string;
}

interface SharedFile {
  id: number;
  filename: string;
  team_id: number;
  uploaded_by_user_id: number;
  uploaded_by_username: string;
  uploaded_at: string; // ISO 8601 string
}

interface Message {
  id: number;
  team_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string; // ISO 8601 string
}

const TeamManagement: React.FC<TeamManagementProps> = ({ showSnackbar, onSummaryGeneratedFromTeamUpload }) => {
  const [teamName, setTeamName] = useState<string>('');
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState<boolean>(false);
  const [memberUsernameToAdd, setMemberUsernameToAdd] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File[] | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false); // New state
  console.log('TeamManagement re-rendered. isUploading:', isUploading);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loadingSharedFiles, setLoadingSharedFiles] = useState<boolean>(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState<boolean>(false); // New state for create team dialog
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageContent, setNewMessageContent] = useState<string>('');
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
  }
  
  function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`team-tabpanel-${index}`}
        aria-labelledby={`team-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        )}
      </div>
    );
  }

  const tabs = [
    { label: 'チーム管理' },
    { label: 'ファイル共有' },
    { label: 'チャット' },
  ];

  const fetchMyTeams = useCallback(async () => {
    setLoadingTeams(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      setLoadingTeams(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/users/me/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Team[] = await response.json();
        setMyTeams(data);
      } else {
        const errorData = await response.json();
        showSnackbar(`チームの取得に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    } finally {
      setLoadingTeams(false);
    }
  }, [showSnackbar]);

  const fetchTeamMembers = useCallback(async (teamId: number) => {
    setLoadingMembers(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      setLoadingMembers(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: TeamMember[] = await response.json();
        setTeamMembers(data);
      } else {
        const errorData = await response.json();
        showSnackbar(`チームメンバーの取得に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
      setTeamMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [showSnackbar]);

  const fetchSharedFiles = useCallback(async (teamId: number) => {
    setLoadingSharedFiles(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      setLoadingSharedFiles(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: SharedFile[] = await response.json();
        setSharedFiles(data);
      } else {
        const errorData = await response.json();
        showSnackbar(`共有ファイルの取得に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        setSharedFiles([]);
      }
    } catch (error) {
      console.error('Error fetching shared files:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
      setSharedFiles([]);
    } finally {
      setLoadingSharedFiles(false);
    }
  }, [showSnackbar]);

  const fetchMessages = useCallback(async (teamId: number) => {
    setLoadingMessages(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      setLoadingMessages(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Message[] = await response.json();
        setMessages(data);
      } else {
        const errorData = await response.json();
        showSnackbar(`メッセージの取得に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchMyTeams();
  }, [fetchMyTeams]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
      fetchSharedFiles(selectedTeam.id);
      fetchMessages(selectedTeam.id);
    }
  }, [selectedTeam, fetchTeamMembers, fetchSharedFiles, fetchMessages]);

  useEffect(() => {
    if (selectedTeam && currentTab === 1) { // 1は「ファイル共有」タブのインデックス
      fetchSharedFiles(selectedTeam.id);
    } else if (selectedTeam && currentTab === 2) { // 2は「チャット」タブのインデックス
      fetchMessages(selectedTeam.id);
    }
  }, [currentTab, selectedTeam, fetchSharedFiles, fetchMessages]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      showSnackbar('チーム名を入力してください。', 'warning');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: teamName }),
      });

      if (response.ok) {
        const data = await response.json();
        showSnackbar(`チーム「${data.team_name}」を作成しました！`, 'success');
        setTeamName(''); // フォームをクリア
        fetchMyTeams(); // チームリストを更新
        setCreateTeamDialogOpen(false); // Close the dialog
      } else {
        const errorData = await response.json();
        showSnackbar(`チーム作成に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(Array.from(event.target.files)); // Convert FileList to Array
    } else {
      setSelectedFile(null);
    }
  };

  const handleFileUpload = async () => {
    console.log('handleFileUpload started, isUploading:', isUploading);
    if (!selectedTeam || !selectedFile || selectedFile.length === 0) {
      showSnackbar('チームとファイルを選択してください。', 'warning');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    setIsUploading(true); // Set loading true at the start
    console.log('isUploading set to true');

    const formData = new FormData();
    selectedFile.forEach((file, index) => {
      formData.append(`files`, file); // Use 'files' as the key for multiple files
    });

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        showSnackbar( data.message, 'success');
        fetchSharedFiles(selectedTeam.id); // ファイルリストを更新

        // Pass summary details to parent component
        if (data.summary_details && onSummaryGeneratedFromTeamUpload) {
          onSummaryGeneratedFromTeamUpload(
            data.summary_details.summary,
            data.summary_details.filename,
            data.summary_details.summary_id,
            data.summary_details.tags,
            data.summary_details.file_path
          );
        }
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルのアップロードに失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    } finally {
      setSelectedFile(null); // ファイル選択をクリア
      setIsUploading(false); // Set loading false at the end
      console.log('isUploading set to false');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam) return;
    if (!memberUsernameToAdd.trim()) {
      showSnackbar('ユーザー名を入力してください。', 'warning');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('member_username', memberUsernameToAdd);

      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showSnackbar(`${memberUsernameToAdd}をチームに追加しました！`, 'success');
        setMemberUsernameToAdd('');
        setAddMemberDialogOpen(false);
        fetchTeamMembers(selectedTeam.id); // メンバーリストを更新
      } else {
        const errorData = await response.json();
        showSnackbar(`メンバー追加に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedTeam) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    if (!window.confirm('本当にこのメンバーを削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showSnackbar('メンバーを削除しました！', 'success');
        fetchTeamMembers(selectedTeam.id); // メンバーリストを更新
      } else {
        const errorData = await response.json();
        showSnackbar(`メンバー削除に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleChangeMemberRole = async (memberId: number, newRole: string) => {
    if (!selectedTeam) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('new_role', newRole);

      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showSnackbar('メンバーの役割を更新しました！', 'success');
        fetchTeamMembers(selectedTeam.id); // メンバーリストを更新
      } else {
        const errorData = await response.json();
        showSnackbar(`役割の更新に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error changing member role:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleFileDownload = async (fileId: number, filename: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showSnackbar('ファイルをダウンロードしました！', 'success');
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルのダウンロードに失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!selectedTeam || !newMessageContent.trim()) {
      showSnackbar('メッセージを入力してください。', 'warning');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMessageContent }),
      });

      if (response.ok) {
        const sentMessage: Message = await response.json();
        setMessages((prevMessages) => [...prevMessages, sentMessage]);
        setNewMessageContent('');
        showSnackbar('メッセージを送信しました！', 'success');
      } else {
        const errorData = await response.json();
        showSnackbar(`メッセージの送信に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  }, [selectedTeam, newMessageContent, showSnackbar]);

  const handleNewMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessageContent(e.target.value);
  }, []);

  const handleNewMessageKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  

  

  const isCurrentUserAdmin = selectedTeam ? myTeams.find(t => t.id === selectedTeam.id)?.role === 'admin' : false;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
            チーム管理
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateTeamDialogOpen(true)}
          >
            新しいチームを作成
          </Button>
        </Box>

        <Dialog open={createTeamDialogOpen} onClose={() => setCreateTeamDialogOpen(false)}
          PaperProps={{
            sx: {
              border: '1px solid #00bcd4', // サイバーチックなボーダー色に変更
              boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)', // より強調されたシャドウ
            }
          }}
        >
          <DialogTitle>新しいチームを作成</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="チーム名"
              type="text"
              fullWidth
              variant="outlined"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateTeamDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreateTeam}>作成</Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            あなたのチーム
          </Typography>
          {loadingTeams ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress />
            </Box>
          ) : myTeams.length === 0 ? (
            <Typography variant="body1">所属しているチームはありません。</Typography>
          ) : (
            <List>
              {myTeams.map((team) => (
                <ListItemButton key={team.id} onClick={() => setSelectedTeam(team)} divider
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 188, 212, 0.1)', // ホバー時の背景色
                    },
                  }}
                >
                  <ListItemText
                    primary={team.name}
                    secondary={`役割: ${team.role}`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        {selectedTeam && (
          <Box sx={{ mt: 4, border: '1px solid #00bcd4', borderRadius: '8px' }}>
            <Box sx={{ borderBottom: 1, borderColor: '#00bcd4' }}>
              <Tabs value={currentTab} onChange={handleTabChange} aria-label="team management tabs">
                {tabs.map((tab, index) => (
                  <Tab label={tab.label} key={index} />
                ))}
              </Tabs>
            </Box>
            <TabPanel value={currentTab} index={0}>
              <Typography variant="h5" component="h2" gutterBottom>
                {selectedTeam.name} のメンバー
              </Typography>
              {isCurrentUserAdmin && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddMemberDialogOpen(true)}
                  sx={{ mb: 2 }}
                >
                  メンバーを追加
                </Button>
              )}
              {loadingMembers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress />
                </Box>
              ) : teamMembers.length === 0 ? (
                <Typography variant="body1">このチームにはメンバーがいません。</Typography>
              ) : (
                <List>
                  {teamMembers.map((member) => (
                    <ListItem key={member.user_id} divider>
                      <ListItemText
                        primary={member.username}
                        secondary={`役割: ${member.role}`}
                      />
                      {isCurrentUserAdmin && (
                        <Box>
                          <FormControl variant="outlined" size="small" sx={{ minWidth: 120, mr: 1 }}>
                            <InputLabel>役割</InputLabel>
                            <Select
                              value={member.role}
                              onChange={(e) => handleChangeMemberRole(member.user_id, e.target.value as string)}
                              label="役割"
                            >
                              <MuiMenuItem value="admin">管理者</MuiMenuItem>
                              <MuiMenuItem value="member">メンバー</MuiMenuItem>
                            </Select>
                          </FormControl>
                          <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveMember(member.user_id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </TabPanel>
            <TabPanel value={currentTab} index={1}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  ファイルを共有
                </Typography>
                <input
                  type="file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="file-upload-button"
                  multiple
                  disabled={isUploading} // Disable during upload
                />
                <label htmlFor="file-upload-button">
                  <Button variant="outlined" component="span" disabled={isUploading}>
                    {selectedFile ? (selectedFile.length === 1 ? selectedFile[0].name : `${selectedFile.length} 個のファイルを選択中`) : 'ファイルを選択'}
                  </Button>
                </label>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isUploading} // Disable during upload
                  sx={{ ml: 2 }}
                >
                  {isUploading ? <CircularProgress size={24} color="inherit" /> : 'アップロード'}
                </Button>
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  共有ファイル
                </Typography>
                {loadingSharedFiles ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress />
                  </Box>
                ) : sharedFiles.length === 0 ? (
                  <Typography variant="body1">共有ファイルはありません。</Typography>
                ) : (
                  <List>
                    {sharedFiles.map((file) => (
                      <ListItem
                        key={file.id}
                        secondaryAction={
                          <IconButton edge="end" aria-label="download" onClick={() => handleFileDownload(file.id, file.filename)}>
                            <DownloadIcon />
                          </IconButton>
                        }
                        divider
                      >
                        <ListItemText
                          primary={file.filename}
                          secondary={`アップロード者: ${file.uploaded_by_username} (${new Date(file.uploaded_at).toLocaleDateString()})`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </TabPanel>
            <TabPanel value={currentTab} index={2}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  チャット
                </Typography>
                <Box sx={{ height: '400px', overflowY: 'auto', border: '1px solid #00bcd4', p: 2, mb: 2 }}>
                  {loadingMessages ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <CircularProgress />
                    </Box>
                  ) : messages.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">まだメッセージはありません。</Typography>
                  ) : (
                    <List>
                      {messages.map((message) => (
                        <ListItem key={message.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {message.username} ({new Date(message.created_at).toLocaleString()})
                          </Typography>
                          <Typography variant="body1">
                            {message.content}
                          </Typography>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
                <TextField
                  autoFocus
                  fullWidth
                  variant="outlined"
                  placeholder="メッセージを入力..."
                  value={newMessageContent}
                  onChange={handleNewMessageChange}
                  onKeyPress={handleNewMessageKeyPress}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSendMessage}
                  fullWidth
                  disabled={!newMessageContent.trim()}
                >
                  送信
                </Button>
              </Box>
            </TabPanel>
          </Box>
        )}

      <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)}
        PaperProps={{
          sx: {
            border: '1px solid #00bcd4', // サイバーチックなボーダー色に変更
            boxShadow: '0 0 15px rgba(0, 188, 212, 0.7)', // より強調されたシャドウ
          }
        }}
      >
        <DialogTitle>メンバーを追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="ユーザー名"
            type="text"
            fullWidth
            variant="outlined"
            value={memberUsernameToAdd}
            onChange={(e) => setMemberUsernameToAdd(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleAddMember}>追加</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Container>
  );
};

export default TeamManagement;