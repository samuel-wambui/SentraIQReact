import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";

const GRAFANA_BASE = import.meta.env.VITE_GRAFANA_BASE ?? "http://localhost:3000";
const GRAFANA_EMBED_PATH =
  import.meta.env.VITE_GRAFANA_EMBED_PATH ?? "/d/socialmedia-channel-messages/channel-message-overview";

const buildGrafanaUrl = (path: string, params?: Record<string, string | number>) => {
  const url = new URL(path, GRAFANA_BASE);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const GrafanaDashboardPanel = memo(() => {
  const { accessToken } = useAuth();
  const [grafanaReady, setGrafanaReady] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(() => Date.now());
  const lastReconnectKeyRef = useRef(reconnectKey);

  const grafanaLoginUrl = useMemo(() => buildGrafanaUrl("/login/generic_oauth"), []);
  const grafanaSsoUrl = useMemo(() => {
    if (!accessToken) return "";

    const params = new URLSearchParams({
      token: accessToken,
      redirect: grafanaLoginUrl,
      sso: String(reconnectKey),
    });

    return `${API_BASE}/login?${params.toString()}`;
  }, [accessToken, grafanaLoginUrl, reconnectKey]);
  const grafanaEmbedUrl = useMemo(() => buildGrafanaUrl(GRAFANA_EMBED_PATH, { orgId: 1 }), []);
  const reconnectGrafana = useCallback(() => setReconnectKey(Date.now()), []);

  useEffect(() => {
    if (!accessToken) {
      setGrafanaReady(false);
      return;
    }

    const reconnectRequested = lastReconnectKeyRef.current !== reconnectKey;
    lastReconnectKeyRef.current = reconnectKey;

    if (grafanaReady && !reconnectRequested) return;

    if (reconnectRequested) {
      setGrafanaReady(false);
    }

    const timeout = window.setTimeout(() => setGrafanaReady(true), 2500);
    return () => window.clearTimeout(timeout);
  }, [accessToken, grafanaReady, reconnectKey]);

  return (
    <>
      {grafanaSsoUrl && (
        <iframe
          key={`grafana-sso-${reconnectKey}`}
          title="Grafana SSO"
          src={grafanaSsoUrl}
          onLoad={() => setGrafanaReady(true)}
          className="hidden"
        />
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Channel Message Overview</h3>
            <p className="text-sm text-muted-foreground">Channel totals and message trends</p>
          </div>
          <Button type="button" variant="outline" onClick={reconnectGrafana} disabled={!accessToken}>
            <RefreshCw className="h-4 w-4" />
            Reconnect SSO
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border bg-white">
          {grafanaReady ? (
            <iframe
              key={`grafana-direct-${reconnectKey}`}
              title="Grafana channel message totals"
              src={grafanaEmbedUrl}
              className="h-[760px] w-full"
            />
          ) : (
            <div className="flex h-[760px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reconnecting Grafana
            </div>
          )}
        </div>
      </section>
    </>
  );
});

GrafanaDashboardPanel.displayName = "GrafanaDashboardPanel";

export default GrafanaDashboardPanel;
