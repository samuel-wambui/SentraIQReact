import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Edit, Loader2, RefreshCw, Shield, Trash2, UserPlus, UserX } from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  pfNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  deleted?: boolean;
  locked?: boolean;
  role?: RoleOption[];
}

interface RoleOption {
  id: number;
  name: string;
  permissions?: string[];
}

interface ApiListResponse<T> {
  entity?: T[];
  users?: T[];
}

const getList = <T,>(data: T[] | ApiListResponse<T>): T[] => {
  if (Array.isArray(data)) return data;
  return data.entity ?? data.users ?? [];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const roleKey = (roleName?: string | null) =>
  String(roleName || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .toUpperCase();

const roleLabel = (roleName?: string | null) => {
  const key = roleKey(roleName);
  if (key === "ANALYST" || key === "AGENT" || key === "USER") return "Agent";
  if (key === "ADMIN") return "Admin";
  if (key === "SUPERUSER" || key === "SUPER_USER") return "Super User";
  return key || "Unknown";
};

const isSupportedRole = (roleName?: string | null) => ["ADMIN", "AGENT", "ANALYST"].includes(roleKey(roleName));

const rolesOf = (profile: UserProfile) => profile.role ?? [];

const makeUsername = (firstName: string, lastName: string, pfNumber: string) => {
  const firstInitial = firstName.trim().charAt(0).toLowerCase();
  const lastInitial = lastName.trim().charAt(0).toLowerCase();
  const pf = pfNumber.trim();
  return firstInitial && lastInitial && pf ? `${firstInitial}${lastInitial}${pf}` : "";
};

const makeEmail = (firstName: string, lastName: string) => {
  const first = firstName.trim().toLowerCase();
  const last = lastName.trim().toLowerCase();
  return first && last ? `${first}.${last}@equitybank.co.ke` : "";
};

const makeUniqueUsername = (
  firstName: string,
  lastName: string,
  pfNumber: string,
  users: UserProfile[],
  currentUserId?: number,
) => {
  const baseUsername = makeUsername(firstName, lastName, pfNumber);
  if (!baseUsername) return "";

  const hasCollision = users.some(
    (profile) => profile.id !== currentUserId && profile.username?.toLowerCase() === baseUsername
  );
  if (!hasCollision) return baseUsername;

  const first = firstName.trim().slice(0, 2).toLowerCase();
  const lastInitial = lastName.trim().charAt(0).toLowerCase();
  const pf = pfNumber.trim();
  return first && lastInitial && pf ? `${first}${lastInitial}${pf}` : baseUsername;
};

const Admin = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [suspendUser, setSuspendUser] = useState<UserProfile | null>(null);
  const [removeRoleConfirm, setRemoveRoleConfirm] = useState<{
    user: UserProfile;
    role: RoleOption;
  } | null>(null);

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPfNumber, setNewPfNumber] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPfNumber, setEditPfNumber] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const visibleRoles = useMemo(() => roles.filter((role) => isSupportedRole(role.name)), [roles]);
  const defaultAgentRole = useMemo(
    () => visibleRoles.find((role) => roleKey(role.name) === "AGENT") ?? visibleRoles.find((role) => roleKey(role.name) === "ANALYST"),
    [visibleRoles]
  );

  useEffect(() => {
    setNewUsername(makeUniqueUsername(newFirstName, newLastName, newPfNumber, users));
    setNewEmail(makeEmail(newFirstName, newLastName));
    setNewPassword(newFirstName.trim() ? `${newFirstName.trim().toLowerCase()}12` : "");
  }, [newFirstName, newLastName, newPfNumber, users]);

  useEffect(() => {
    if (!editUserOpen || !selectedUser) return;
    setEditUsername(makeUniqueUsername(editFirstName, editLastName, editPfNumber, users, selectedUser.id));
    setEditEmail(makeEmail(editFirstName, editLastName));
  }, [editFirstName, editLastName, editPfNumber, editUserOpen, selectedUser, users]);

  useEffect(() => {
    if (!newRoleId && defaultAgentRole) {
      setNewRoleId(String(defaultAgentRole.id));
    }
  }, [defaultAgentRole, newRoleId]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiFetch<UserProfile[] | ApiListResponse<UserProfile>>("/api/users/getAllUsers");
      setUsers(getList(data).filter((profile) => !profile.deleted));
    } catch (error: unknown) {
      setUsers([]);
      toast({
        title: "Users unavailable",
        description: getErrorMessage(error, "Unable to fetch users."),
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const data = await apiFetch<RoleOption[] | ApiListResponse<RoleOption>>("/api/roles/getAllRoles");
      setRoles(getList(data));
    } catch (error: unknown) {
      setRoles([]);
      toast({
        title: "Roles unavailable",
        description: getErrorMessage(error, "Unable to fetch roles."),
        variant: "destructive",
      });
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchRoles();
  }, []);

  const openAddUser = () => {
    setNewFirstName("");
    setNewLastName("");
    setNewPfNumber("");
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setNewRoleId(defaultAgentRole ? String(defaultAgentRole.id) : "");
    setAddUserOpen(true);
  };

  const openEditUser = (profile: UserProfile) => {
    setSelectedUser(profile);
    setEditFirstName(profile.firstName ?? "");
    setEditLastName(profile.lastName ?? "");
    setEditPfNumber(profile.pfNumber ?? "");
    setEditUsername(profile.username ?? "");
    setEditEmail(profile.email ?? "");
    setEditUserOpen(true);
  };

  const openAssignRole = (profile: UserProfile) => {
    setSelectedUser(profile);
    setSelectedRoleId("");
    setAssignRoleOpen(true);
  };

  const handleAddUser = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast({
        title: "User details required",
        description: "Enter first name, last name, email, and password.",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiFetch("/api/users/signup", {
        method: "POST",
        body: {
          username: newUsername,
          pfNumber: newPfNumber.trim() || null,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          email: newEmail.trim(),
          password: newPassword,
        },
      });

      if (newRoleId) {
        const params = new URLSearchParams({ roleId: newRoleId, username: newUsername });
        await apiFetch(`/api/roles/assignRole?${params}`, { method: "POST" });
      }

      toast({ title: "User created" });
      setAddUserOpen(false);
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "User not created",
        description: getErrorMessage(error, "Unable to add user."),
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await apiFetch(`/api/users/updateUser/${selectedUser.id}`, {
        method: "PUT",
        body: {
          username: editUsername,
          pfNumber: editPfNumber.trim() || null,
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
        },
      });
      toast({ title: "User updated" });
      setEditUserOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "User not updated",
        description: getErrorMessage(error, "Unable to update user."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      await apiFetch(`/api/users/${deleteUser.id}`, { method: "DELETE" });
      toast({ title: "User deleted" });
      setDeleteUser(null);
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "User not deleted",
        description: getErrorMessage(error, "Unable to delete user."),
        variant: "destructive",
      });
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendUser) return;

    try {
      await apiFetch(`/api/users/${suspendUser.id}/suspend`, { method: "PUT" });
      toast({ title: "User suspended" });
      setSuspendUser(null);
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "User not suspended",
        description: getErrorMessage(error, "Unable to suspend user."),
        variant: "destructive",
      });
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) return;

    try {
      const params = new URLSearchParams({ roleId: selectedRoleId, username: selectedUser.username });
      await apiFetch(`/api/roles/assignRole?${params}`, { method: "POST" });
      toast({ title: "Role assigned" });
      setAssignRoleOpen(false);
      setSelectedUser(null);
      setSelectedRoleId("");
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "Role not assigned",
        description: getErrorMessage(error, "Unable to assign role."),
        variant: "destructive",
      });
    }
  };

  const handleRemoveRole = async () => {
    if (!removeRoleConfirm) return;

    try {
      const params = new URLSearchParams({
        username: removeRoleConfirm.user.username,
        roleId: String(removeRoleConfirm.role.id),
      });
      await apiFetch(`/api/roles/removeRole?${params}`, { method: "POST" });
      toast({ title: "Role removed" });
      setRemoveRoleConfirm(null);
      await fetchUsers();
    } catch (error: unknown) {
      toast({
        title: "Role not removed",
        description: getErrorMessage(error, "Unable to remove role."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Admin</h2>
          <p className="text-muted-foreground">Create users, delete accounts, and assign admin or agent roles</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => { void fetchUsers(); void fetchRoles(); }} disabled={loadingUsers || loadingRoles}>
            <RefreshCw className={`h-4 w-4 ${loadingUsers || loadingRoles ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={openAddUser}>
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>PF Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username}
                      </TableCell>
                      <TableCell>{profile.username}</TableCell>
                      <TableCell>{profile.pfNumber || "-"}</TableCell>
                      <TableCell>{profile.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={profile.locked ? "destructive" : "secondary"}>
                          {profile.locked ? "Locked" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rolesOf(profile).length === 0 ? (
                            <Badge variant="outline">No role</Badge>
                          ) : (
                            rolesOf(profile).map((role) => (
                              <Badge
                                key={role.id}
                                variant={["ADMIN", "SUPERUSER", "SUPER_USER"].includes(roleKey(role.name)) ? "default" : "secondary"}
                              >
                                {roleLabel(role.name)}
                                <button
                                  type="button"
                                  className="ml-1 text-xs hover:text-destructive"
                                  onClick={() => setRemoveRoleConfirm({ user: profile, role })}
                                  aria-label={`Remove ${roleLabel(role.name)} role from ${profile.username}`}
                                >
                                  x
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openAssignRole(profile)}>
                            <Shield className="h-4 w-4" />
                            Role
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEditUser(profile)}>
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSuspendUser(profile)}>
                            <UserX className="h-4 w-4" />
                            Suspend
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteUser(profile)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="new-first-name">First Name</Label>
              <Input id="new-first-name" value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-last-name">Last Name</Label>
              <Input id="new-last-name" value={newLastName} onChange={(event) => setNewLastName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-pf-number">PF Number</Label>
              <Input id="new-pf-number" value={newPfNumber} onChange={(event) => setNewPfNumber(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-username">Username</Label>
              <Input id="new-username" value={newUsername} readOnly />
            </div>
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-password">Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="new-role">Role</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger id="new-role">
                  <SelectValue placeholder={loadingRoles ? "Loading roles" : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {visibleRoles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {roleLabel(role.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleAddUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="edit-first-name">First Name</Label>
              <Input id="edit-first-name" value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-last-name">Last Name</Label>
              <Input id="edit-last-name" value={editLastName} onChange={(event) => setEditLastName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-pf-number">PF Number</Label>
              <Input id="edit-pf-number" value={editPfNumber} onChange={(event) => setEditPfNumber(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-username">Username</Label>
              <Input id="edit-username" value={editUsername} readOnly />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditUserOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleEditUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignRoleOpen} onOpenChange={setAssignRoleOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-role">Role for {selectedUser?.username}</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger id="assign-role">
                <SelectValue placeholder={loadingRoles ? "Loading roles" : "Select a role"} />
              </SelectTrigger>
              <SelectContent>
                {visibleRoles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {roleLabel(role.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignRoleOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleAssignRole} disabled={!selectedRoleId}>Assign Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{deleteUser?.username}</strong>. The account will no longer appear in user management.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(suspendUser)} onOpenChange={(open) => { if (!open) setSuspendUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend User</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend <strong>{suspendUser?.username}</strong> by removing their access roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendUser} className="bg-destructive hover:bg-destructive/90">
              Suspend User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(removeRoleConfirm)} onOpenChange={(open) => { if (!open) setRemoveRoleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{roleLabel(removeRoleConfirm?.role.name)}</strong> from{" "}
              <strong>{removeRoleConfirm?.user.username}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveRole} className="bg-destructive hover:bg-destructive/90">
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
