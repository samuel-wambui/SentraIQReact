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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Edit, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

interface RoleRecord {
  id: number;
  name: string;
  permissions?: string[];
  deleted?: boolean;
}

interface ApiListResponse<T> {
  entity?: T[];
  roles?: T[];
}

const PERMISSIONS = [
  "SUPERUSER_READ",
  "SUPERUSER_CREATE",
  "SUPERUSER_UPDATE",
  "SUPERUSER_DELETE",
  "ADMIN_READ",
  "ADMIN_CREATE",
  "ADMIN_UPDATE",
  "ADMIN_DELETE",
  "ANALYST_READ",
  "ANALYST_CREATE",
  "ANALYST_UPDATE",
  "ANALYST_DELETE",
];

const SYSTEM_ROLES = new Set(["SUPERUSER", "ADMIN", "ANALYST", "AGENT"]);

const getList = <T,>(data: T[] | ApiListResponse<T>): T[] => {
  if (Array.isArray(data)) return data;
  return data.entity ?? data.roles ?? [];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const roleNameKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .toUpperCase();

const displayRoleName = (value?: string | null) => {
  const key = roleNameKey(value);
  if (key === "ANALYST" || key === "AGENT") return "Agent";
  if (key === "SUPERUSER" || key === "SUPER_USER") return "Super User";
  if (key === "ADMIN") return "Admin";
  return key || "Unknown";
};

const displayPermission = (permission: string) =>
  permission
    .replace(/^ANALYST_/, "AGENT_")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const SuperUserDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [deleteRole, setDeleteRole] = useState<RoleRecord | null>(null);

  const sortedRoles = useMemo(
    () => [...roles].sort((first, second) => displayRoleName(first.name).localeCompare(displayRoleName(second.name))),
    [roles]
  );

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<RoleRecord[] | ApiListResponse<RoleRecord>>("/api/roles/getAllRoles");
      setRoles(getList(data).filter((role) => !role.deleted));
    } catch (error: unknown) {
      setRoles([]);
      toast({
        title: "Roles unavailable",
        description: getErrorMessage(error, "Unable to fetch roles."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
  }, []);

  const togglePermission = (permission: string, checked: boolean) => {
    setSelectedPermissions((current) =>
      checked ? Array.from(new Set([...current, permission])) : current.filter((item) => item !== permission)
    );
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setSelectedPermissions([]);
    setDialogOpen(true);
  };

  const openEditRole = (role: RoleRecord) => {
    setEditingRole(role);
    setRoleName(role.name);
    setSelectedPermissions(role.permissions ?? []);
    setDialogOpen(true);
  };

  const saveRole = async () => {
    const normalizedName = roleNameKey(roleName);
    if (!normalizedName || selectedPermissions.length === 0) {
      toast({
        title: "Role details required",
        description: "Enter a role name and select at least one permission.",
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams({
      roleName: normalizedName,
      postedBy: user?.username ?? "system",
      permissions: selectedPermissions.join(","),
    });

    try {
      if (editingRole) {
        const updateParams = new URLSearchParams({ permissions: selectedPermissions.join(",") });
        await apiFetch(`/api/roles/update/${editingRole.id}?${updateParams}`, { method: "PUT" });
        toast({ title: "Role updated" });
      } else {
        await apiFetch(`/api/roles/create?${params}`, { method: "POST" });
        toast({ title: "Role created" });
      }

      setDialogOpen(false);
      setEditingRole(null);
      setRoleName("");
      setSelectedPermissions([]);
      await fetchRoles();
    } catch (error: unknown) {
      toast({
        title: editingRole ? "Role not updated" : "Role not created",
        description: getErrorMessage(error, "Unable to save role."),
        variant: "destructive",
      });
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRole) return;

    try {
      await apiFetch(`/api/roles/delete/${deleteRole.id}`, { method: "DELETE" });
      toast({ title: "Role deleted" });
      setDeleteRole(null);
      await fetchRoles();
    } catch (error: unknown) {
      toast({
        title: "Role not deleted",
        description: getErrorMessage(error, "Unable to delete role."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Super User</h2>
          <p className="text-muted-foreground">Create roles and manage role permissions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void fetchRoles()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={openCreateRole}>
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading roles
            </div>
          ) : sortedRoles.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">No roles found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRoles.map((role) => {
                    const systemRole = SYSTEM_ROLES.has(roleNameKey(role.name));
                    return (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{displayRoleName(role.name)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(role.permissions ?? []).length === 0 ? (
                              <Badge variant="outline">No permissions</Badge>
                            ) : (
                              (role.permissions ?? []).map((permission) => (
                                <Badge key={permission} variant="secondary">
                                  {displayPermission(permission)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEditRole(role)}>
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteRole(role)}
                              disabled={systemRole}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[840px]">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value.toUpperCase())}
                readOnly={Boolean(editingRole)}
                placeholder="AGENT"
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PERMISSIONS.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <Checkbox
                      checked={selectedPermissions.includes(permission)}
                      onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                    />
                    {displayPermission(permission)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveRole}>{editingRole ? "Save Role" : "Create Role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteRole)} onOpenChange={(open) => { if (!open) setDeleteRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{displayRoleName(deleteRole?.name)}</strong>. Users with this role may lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole} className="bg-destructive hover:bg-destructive/90">
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperUserDashboard;
