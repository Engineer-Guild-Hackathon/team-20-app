import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Container, TextField, Button, List, ListItem, ListItemButton, ListItemText, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem as MuiMenuItem, FormControl, InputLabel, Tabs, Tab } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';

interface TeamManagementProps {
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
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

const TeamManagement: React.FC<TeamManagementProps> = ({ showSnackbar }) => {
  const [teamName, setTeamName] = useState<string>('');
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState<boolean>(false);
  const [memberUsernameToAdd, setMemberUsernameToAdd] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loadingSharedFiles, setLoadingSharedFiles] = useState<boolean>(false);

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

  useEffect(() => {
    fetchMyTeams();
  }, [fetchMyTeams]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
      // selectedTeam が変更されたら、ファイルも取得
      fetchSharedFiles(selectedTeam.id);
    }
  }, [selectedTeam, fetchTeamMembers, fetchSharedFiles]);

  // currentTab が変更されたら、ファイル共有タブの場合にファイルを再取得
  useEffect(() => {
    if (selectedTeam && currentTab === 1) { // 1は「ファイル共有」タブのインデックス
      fetchSharedFiles(selectedTeam.id);
    }
  }, [currentTab, selectedTeam, fetchSharedFiles]);

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
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedTeam || !selectedFile) {
      showSnackbar('チームとファイルを選択してください。', 'warning');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${selectedTeam.id}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showSnackbar('ファイルが正常にアップロードされました！', 'success');
        setSelectedFile(null); // ファイル選択をクリア
        fetchSharedFiles(selectedTeam.id); // ファイルリストを更新
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルのアップロードに失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
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

  const isCurrentUserAdmin = selectedTeam ? myTeams.find(t => t.id === selectedTeam.id)?.role === 'admin' : false;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          チーム管理
        </Typography>

        <Box sx={{ mt: 4, p: 3, border: '1px solid #ccc', borderRadius: '8px' }}>
          <Typography variant="h5" component="h2" gutterBottom>
            新しいチームを作成
          </Typography>
          <TextField
            label="チーム名"
            variant="outlined"
            fullWidth
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button variant="contained" color="primary" onClick={handleCreateTeam}>
            チームを作成
          </Button>
        </Box>

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
                <ListItemButton key={team.id} onClick={() => setSelectedTeam(team)} divider>
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
          <Box sx={{ mt: 4, border: '1px solid #ccc', borderRadius: '8px' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
                />
                <label htmlFor="file-upload-button">
                  <Button variant="outlined" component="span">
                    {selectedFile ? selectedFile.name : 'ファイルを選択'}
                  </Button>
                </label>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleFileUpload}
                  disabled={!selectedFile}
                  sx={{ ml: 2 }}
                >
                  アップロード
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
          </Box>
        )}

      <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)}>
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