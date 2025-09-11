import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Container, TextField, Button, List, ListItem, ListItemButton, ListItemText, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem as MuiMenuItem, FormControl, InputLabel } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
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

interface TeamFile {
  id: number;
  filename: string;
  filesize: number;
  created_at: string;
  uploaded_by: string;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ showSnackbar }) => {
  const [teamName, setTeamName] = useState<string>('');
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [teamFiles, setTeamFiles] = useState<TeamFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState<boolean>(false);
  const [memberUsernameToAdd, setMemberUsernameToAdd] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchMyTeams = async () => {
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
  };

  const fetchTeamMembers = async (teamId: number) => {
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
  };

  useEffect(() => {
    fetchMyTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
      fetchTeamFiles(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchTeamFiles = async (teamId: number) => {
    setLoadingFiles(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      setLoadingFiles(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: TeamFile[] = await response.json();
        setTeamFiles(data);
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイル一覧の取得に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
        setTeamFiles([]);
      }
    } catch (error) {
      console.error('Error fetching team files:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
      setTeamFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedTeam) {
      handleFileUpload(file, selectedTeam.id);
    }
    // Reset the input value to allow re-uploading the same file
    event.target.value = '';
  };

  const handleFileUpload = async (file: File, teamId: number) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showSnackbar('ファイルが正常にアップロードされました', 'success');
        fetchTeamFiles(teamId); // Refresh the file list
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルのアップロードに失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
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
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルのダウンロードに失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

  const handleFileDelete = async (fileId: number) => {
    if (!selectedTeam) return;
    if (!window.confirm('本当にこのファイルを削除しますか？元に戻すことはできません。')) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      showSnackbar('ログインしていません。', 'error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showSnackbar('ファイルを削除しました', 'success');
        fetchTeamFiles(selectedTeam.id); // Refresh the file list
      } else {
        const errorData = await response.json();
        showSnackbar(`ファイルの削除に失敗しました: ${errorData.detail || '不明なエラー'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showSnackbar('ネットワークエラーが発生しました。', 'error');
    }
  };

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

  const isCurrentUserAdmin = selectedTeam ? myTeams.find(t => t.id === selectedTeam.id)?.role === 'admin' : false;

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
          <Box sx={{ mt: 4, p: 3, border: '1px solid #ccc', borderRadius: '8px' }}>
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
          </Box>
        )}

        {selectedTeam && (
          <Box sx={{ mt: 4, p: 3, border: '1px solid #ccc', borderRadius: '8px' }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {selectedTeam.name} の共有ファイル
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleUploadClick}
              sx={{ mb: 2 }}
            >
              ファイルをアップロード
            </Button>
            {loadingFiles ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress />
              </Box>
            ) : teamFiles.length === 0 ? (
              <Typography variant="body1">共有されているファイルはありません。</Typography>
            ) : (
              <List>
                {teamFiles.map((file) => {
                  const token = localStorage.getItem('access_token');
                  let currentUsername = '';
                  if (token) {
                    try {
                      const payload = JSON.parse(atob(token.split('.')[1]));
                      currentUsername = payload.sub; // Assuming username is in 'sub' claim
                    } catch (e) {
                      console.error('Failed to decode token', e);
                    }
                  }

                  const isUploader = file.uploaded_by === currentUsername;
                  const canDelete = isCurrentUserAdmin || isUploader;

                  return (
                    <ListItem key={file.id} divider>
                      <ListItemText
                        primary={file.filename}
                        secondary={`アップロード者: ${file.uploaded_by} | サイズ: ${(file.filesize / 1024).toFixed(2)} KB | 日時: ${new Date(file.created_at).toLocaleString()}`}
                      />
                      <IconButton edge="end" aria-label="download" onClick={() => handleFileDownload(file.id, file.filename)}>
                        <DownloadIcon />
                      </IconButton>
                      {canDelete && (
                        <IconButton edge="end" aria-label="delete" onClick={() => handleFileDelete(file.id)}>
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            )}
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