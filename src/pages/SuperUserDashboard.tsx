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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { OAuthClientsApi } from "@/lib/backend";
import { Copy, Edit, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

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

interface ApiEntityResponse<T> {
  message?: string;
  statusCode?: number;
  entity?: T;
}

interface OAuthClientEndpoints {
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  discoveryUrl?: string;
}

interface OAuthClientRegistrationResult extends OAuthClientEndpoints {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  grantTypes?: string[];
  note?: string;
}

interface OAuthClientForm {
  clientId: string;
  clientName: string;
  clientSecret: string;
  redirectUris: string;
  scopes: string[];
  grantTypes: string[];
  requireConsent: boolean;
  accessTokenTtlMinutes: string;
  refreshTokenTtlHours: string;
}

interface OAuthClientRecord extends OAuthClientEndpoints {
  id: string;
  clientId: string;
  clientName?: string;
  clientAuthenticationMethods?: string[];
  grantTypes?: string[];
  redirectUris?: string[];
  scopes?: string[];
  deleted?: boolean;
  modifiedBy?: string | null;
  modifiedTime?: string | null;
  deletedBy?: string | null;
  deletedTime?: string | null;
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
const OIDC_SCOPES = ["openid", "profile", "email"];
const OAUTH_GRANT_TYPES = ["authorization_code", "refresh_token", "client_credentials"];

const GRAFANA_CLIENT_DEFAULTS: OAuthClientForm = {
  clientId: "grafana",
  clientName: "Grafana",
  clientSecret: "secret",
  redirectUris: "http://localhost:3000/login/generic_oauth",
  scopes: ["openid", "profile", "email"],
  grantTypes: ["authorization_code", "refresh_token"],
  requireConsent: false,
  accessTokenTtlMinutes: "30",
  refreshTokenTtlHours: "24",
};

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

const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const parsePositiveInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toggleValue = (values: string[], value: string, checked: boolean) =>
  checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value);

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
  const [clientForm, setClientForm] = useState<OAuthClientForm>(GRAFANA_CLIENT_DEFAULTS);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientEndpoints, setClientEndpoints] = useState<OAuthClientEndpoints | null>(null);
  const [registeredClient, setRegisteredClient] = useState<OAuthClientRegistrationResult | null>(null);
  const [oauthClients, setOauthClients] = useState<OAuthClientRecord[]>([]);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [deleteClient, setDeleteClient] = useState<OAuthClientRecord | null>(null);

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

  const fetchClientMetadata = async () => {
    try {
      const data = await OAuthClientsApi.registeredClients() as ApiEntityResponse<OAuthClientEndpoints>;
      setClientEndpoints(data.entity ?? null);
    } catch (error: unknown) {
      toast({
        title: "SSO metadata unavailable",
        description: getErrorMessage(error, "Unable to fetch SSO endpoints."),
        variant: "destructive",
      });
    }
  };

  const fetchOAuthClients = async () => {
    setClientsLoading(true);
    try {
      const data = await OAuthClientsApi.listClients() as ApiEntityResponse<OAuthClientRecord[]>;
      setOauthClients(data.entity ?? []);
    } catch (error: unknown) {
      setOauthClients([]);
      toast({
        title: "SSO clients unavailable",
        description: getErrorMessage(error, "Unable to fetch SSO clients."),
        variant: "destructive",
      });
    } finally {
      setClientsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
    void fetchClientMetadata();
    void fetchOAuthClients();
  }, []);

  const togglePermission = (permission: string, checked: boolean) => {
    setSelectedPermissions((current) => toggleValue(current, permission, checked));
  };

  const updateClientForm = <K extends keyof OAuthClientForm>(key: K, value: OAuthClientForm[K]) => {
    setClientForm((current) => ({ ...current, [key]: value }));
  };

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        title: "Copy failed",
        description: value,
        variant: "destructive",
      });
    }
  };

  const resetClientForm = () => {
    setClientForm(GRAFANA_CLIENT_DEFAULTS);
    setEditingClientId(null);
    setRegisteredClient(null);
  };

  const editOAuthClient = (client: OAuthClientRecord) => {
    setEditingClientId(client.clientId);
    setRegisteredClient(null);
    setClientForm({
      clientId: client.clientId,
      clientName: client.clientName ?? client.clientId,
      clientSecret: "",
      redirectUris: (client.redirectUris ?? []).join("\n"),
      scopes: client.scopes?.length ? client.scopes : ["openid", "profile", "email"],
      grantTypes: client.grantTypes?.length ? client.grantTypes : ["authorization_code", "refresh_token"],
      requireConsent: false,
      accessTokenTtlMinutes: "30",
      refreshTokenTtlHours: "24",
    });
    document.getElementById("sso-clients")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const saveOAuthClient = async () => {
    const clientId = clientForm.clientId.trim();
    const redirectUris = splitLines(clientForm.redirectUris);

    if (!clientId || redirectUris.length === 0 || clientForm.scopes.length === 0 || clientForm.grantTypes.length === 0) {
      toast({
        title: "Client details required",
        description: "Enter a client ID, at least one redirect URI, scope, and grant type.",
        variant: "destructive",
      });
      return;
    }

    setClientLoading(true);
    try {
      const body = {
        clientId,
        clientName: clientForm.clientName.trim() || clientId,
        clientSecret: clientForm.clientSecret.trim() || undefined,
        redirectUris,
        scopes: clientForm.scopes,
        grantTypes: clientForm.grantTypes,
        requireConsent: clientForm.requireConsent,
        accessTokenTtlMinutes: parsePositiveInt(clientForm.accessTokenTtlMinutes, 30),
        refreshTokenTtlHours: parsePositiveInt(clientForm.refreshTokenTtlHours, 24),
      };

      const data = (editingClientId
        ? await OAuthClientsApi.updateClient(editingClientId, body, user?.username)
        : await OAuthClientsApi.register(body)) as ApiEntityResponse<OAuthClientRegistrationResult | OAuthClientRecord>;

      if (!editingClientId && data.entity) {
        setRegisteredClient(data.entity as OAuthClientRegistrationResult);
      }
      toast({
        title: editingClientId ? "SSO client updated" : "SSO client registered",
        description: data.entity?.clientId ?? clientId,
      });
      await fetchClientMetadata();
      await fetchOAuthClients();
      if (editingClientId) resetClientForm();
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to save OAuth client.");
      if (!editingClientId && message.includes("already exists")) {
        toast({ title: "SSO client already exists", description: `${clientId} is already ready to use.` });
        await fetchOAuthClients();
        return;
      }

      toast({
        title: editingClientId ? "SSO client not updated" : "SSO client not registered",
        description: message,
        variant: "destructive",
      });
    } finally {
      setClientLoading(false);
    }
  };

  const confirmDeleteOAuthClient = async () => {
    if (!deleteClient) return;

    try {
      await OAuthClientsApi.deleteClient(deleteClient.clientId, user?.username);
      toast({ title: "SSO client deleted", description: deleteClient.clientId });
      setDeleteClient(null);
      if (editingClientId === deleteClient.clientId) resetClientForm();
      await fetchOAuthClients();
    } catch (error: unknown) {
      toast({
        title: "SSO client not deleted",
        description: getErrorMessage(error, "Unable to delete OAuth client."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Super User</h2>
          <p className="text-muted-foreground">Create roles, manage permissions, and register SSO clients</p>
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

      <Card id="sso-clients">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            SSO Clients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    value={clientForm.clientId}
                    onChange={(event) => updateClientForm("clientId", event.target.value)}
                    placeholder="grafana"
                  />
                </div>
                <div>
                  <Label htmlFor="client-name">Client Name</Label>
                  <Input
                    id="client-name"
                    value={clientForm.clientName}
                    onChange={(event) => updateClientForm("clientName", event.target.value)}
                    placeholder="Grafana"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  value={clientForm.clientSecret}
                  onChange={(event) => updateClientForm("clientSecret", event.target.value)}
                  placeholder="Leave blank to generate one"
                />
              </div>

              <div>
                <Label htmlFor="redirect-uris">Redirect URIs</Label>
                <Textarea
                  id="redirect-uris"
                  value={clientForm.redirectUris}
                  onChange={(event) => updateClientForm("redirectUris", event.target.value)}
                  rows={3}
                  placeholder="http://localhost:3000/login/generic_oauth"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="access-token-ttl">Access Token TTL Minutes</Label>
                  <Input
                    id="access-token-ttl"
                    type="number"
                    min="1"
                    value={clientForm.accessTokenTtlMinutes}
                    onChange={(event) => updateClientForm("accessTokenTtlMinutes", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="refresh-token-ttl">Refresh Token TTL Hours</Label>
                  <Input
                    id="refresh-token-ttl"
                    type="number"
                    min="1"
                    value={clientForm.refreshTokenTtlHours}
                    onChange={(event) => updateClientForm("refreshTokenTtlHours", event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label>Scopes</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {OIDC_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                      <Checkbox
                        checked={clientForm.scopes.includes(scope)}
                        onCheckedChange={(checked) =>
                          updateClientForm("scopes", toggleValue(clientForm.scopes, scope, checked === true))
                        }
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Grant Types</Label>
                <div className="mt-2 grid gap-2">
                  {OAUTH_GRANT_TYPES.map((grantType) => (
                    <label key={grantType} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                      <Checkbox
                        checked={clientForm.grantTypes.includes(grantType)}
                        onCheckedChange={(checked) =>
                          updateClientForm("grantTypes", toggleValue(clientForm.grantTypes, grantType, checked === true))
                        }
                      />
                      {grantType}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="require-consent">Require Consent</Label>
                  <p className="text-sm text-muted-foreground">Keep this off for Grafana silent SSO.</p>
                </div>
                <Switch
                  id="require-consent"
                  checked={clientForm.requireConsent}
                  onCheckedChange={(checked) => updateClientForm("requireConsent", checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetClientForm}>
              {editingClientId ? "Cancel Edit" : "Grafana Defaults"}
            </Button>
            <Button type="button" onClick={saveOAuthClient} disabled={clientLoading}>
              {clientLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingClientId ? "Update SSO Client" : "Register SSO Client"}
            </Button>
          </div>

          {registeredClient && (
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Registered Client</h3>
                  <p className="text-sm text-muted-foreground">{registeredClient.note}</p>
                </div>
                <Badge variant="secondary">{registeredClient.clientId}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Client Secret", registeredClient.clientSecret],
                  ["Auth URL", registeredClient.authUrl],
                  ["Token URL", registeredClient.tokenUrl],
                  ["User Info URL", registeredClient.userInfoUrl],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-background p-3">
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all text-sm">{value}</code>
                      <Button type="button" variant="ghost" size="icon" onClick={() => void copyValue(label, value)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clientEndpoints && (
            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold">SSO Endpoints</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchClientMetadata()}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Authorization", clientEndpoints.authUrl],
                  ["Token", clientEndpoints.tokenUrl],
                  ["User Info", clientEndpoints.userInfoUrl],
                  ["JWKS", clientEndpoints.jwksUrl],
                  ["Discovery", clientEndpoints.discoveryUrl],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted/40 p-3">
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all text-sm">{value ?? "Unavailable"}</code>
                      {value && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => void copyValue(label, value)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Registered SSO Clients</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchOAuthClients()} disabled={clientsLoading}>
                <RefreshCw className={`h-4 w-4 ${clientsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {clientsLoading ? (
              <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading SSO clients
              </div>
            ) : oauthClients.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">No SSO clients found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Redirect URIs</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Grant Types</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oauthClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div className="font-medium">{client.clientId}</div>
                          <div className="text-sm text-muted-foreground">{client.clientName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[360px] space-y-1">
                            {(client.redirectUris ?? []).map((uri) => (
                              <div key={uri} className="break-all text-sm">{uri}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(client.scopes ?? []).map((scope) => (
                              <Badge key={scope} variant="secondary">{scope}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(client.grantTypes ?? []).map((grantType) => (
                              <Badge key={grantType} variant="outline">{grantType}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => editOAuthClient(client)}>
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteClient(client)}>
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
          </div>
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

      <AlertDialog open={Boolean(deleteClient)} onOpenChange={(open) => { if (!open) setDeleteClient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SSO Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable <strong>{deleteClient?.clientId}</strong> for OAuth login until it is registered again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOAuthClient} className="bg-destructive hover:bg-destructive/90">
              Delete Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperUserDashboard;
