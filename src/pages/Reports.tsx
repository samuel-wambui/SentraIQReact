import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConversationsApi,
  SUPPORTED_CHANNELS,
  type CategoryCaseReport,
  type ChannelCaseReport,
  type ChannelCategoryCaseReport,
  type ConversationReportsResponse,
  type HandledCaseReport,
} from "@/lib/conversations";

type ReportEnvelope = { entity?: ConversationReportsResponse } | ConversationReportsResponse;

const ALL_VALUE = "all";

const emptyReport: ConversationReportsResponse = {
  totalCases: 0,
  positiveCases: 0,
  negativeCases: 0,
  neutralCases: 0,
  positiveByCategory: [],
  negativeByCategory: [],
  byChannel: [],
  byChannelAndCategory: [],
  handledByUsernameCategoryChannel: [],
};

const sentimentOptions = [
  { value: ALL_VALUE, label: "All sentiments" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "neutral", label: "Neutral" },
];

const periodOptions = [
  { value: ALL_VALUE, label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const unwrapReport = (data: ReportEnvelope): ConversationReportsResponse => {
  if (data && typeof data === "object" && "entity" in data && data.entity) {
    return data.entity;
  }

  return data as ConversationReportsResponse;
};

const formatNumber = (value?: number) => Number(value ?? 0).toLocaleString();

const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const periodParams = (period: string) => {
  if (period === ALL_VALUE) return {};

  const today = new Date();
  const from = new Date(today);

  if (period === "7d") {
    from.setDate(today.getDate() - 6);
  } else if (period === "30d") {
    from.setDate(today.getDate() - 29);
  }

  return {
    from: formatDateParam(from),
    to: formatDateParam(today),
  };
};

const mergeOptions = (current: string[], next: string[]) =>
  Array.from(new Set([...current, ...next].filter(Boolean))).sort((first, second) =>
    first.localeCompare(second)
  );

const reportCategories = (report: ConversationReportsResponse) =>
  Array.from(
    new Set([
      ...report.positiveByCategory.map((row) => row.category),
      ...report.negativeByCategory.map((row) => row.category),
      ...report.byChannelAndCategory.map((row) => row.category),
      ...report.handledByUsernameCategoryChannel.map((row) => row.category),
    ])
  ).filter(Boolean);

const reportUsernames = (report: ConversationReportsResponse) =>
  Array.from(new Set(report.handledByUsernameCategoryChannel.map((row) => row.username))).filter(Boolean);

const TotalCard = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "negative" | "neutral";
}) => {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
      ? "text-rose-700"
      : tone === "neutral"
      ? "text-slate-600"
      : "text-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
};

const TableEmpty = ({ colSpan }: { colSpan: number }) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="h-20 text-center text-muted-foreground">
      No rows
    </TableCell>
  </TableRow>
);

const TableShell = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="rounded-md border">
    {title && <div className="border-b px-4 py-3 text-sm font-semibold text-foreground">{title}</div>}
    {children}
  </div>
);

const CategoryTable = ({ title, rows }: { title: string; rows: CategoryCaseReport[] }) => (
  <TableShell title={title}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Cases</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={2} />
        ) : (
          rows.map((row) => (
            <TableRow key={row.category}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell className="text-right font-semibold">{formatNumber(row.totalCases)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableShell>
);

const ChannelTable = ({ rows }: { rows: ChannelCaseReport[] }) => (
  <TableShell>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Positive</TableHead>
          <TableHead className="text-right">Negative</TableHead>
          <TableHead className="text-right">Neutral</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={5} />
        ) : (
          rows.map((row) => (
            <TableRow key={row.channel}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right font-semibold">{formatNumber(row.totalCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.positiveCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.negativeCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.neutralCases)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableShell>
);

const ChannelCategoryTable = ({ rows }: { rows: ChannelCategoryCaseReport[] }) => (
  <TableShell>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Positive</TableHead>
          <TableHead className="text-right">Negative</TableHead>
          <TableHead className="text-right">Neutral</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={6} />
        ) : (
          rows.map((row) => (
            <TableRow key={`${row.channel}-${row.category}`}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="text-right font-semibold">{formatNumber(row.totalCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.positiveCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.negativeCases)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.neutralCases)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableShell>
);

const HandledTable = ({ rows }: { rows: HandledCaseReport[] }) => (
  <TableShell>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Cases</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={4} />
        ) : (
          rows.map((row) => (
            <TableRow key={`${row.username}-${row.channel}-${row.category}`}>
              <TableCell className="font-medium">{row.username}</TableCell>
              <TableCell>{row.label}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="text-right font-semibold">{formatNumber(row.totalCases)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableShell>
);

const ReportSection = ({
  value,
  title,
  count,
  children,
}: {
  value: string;
  title: string;
  count: number;
  children: ReactNode;
}) => (
  <AccordionItem value={value} className="rounded-md border bg-card px-4">
    <AccordionTrigger className="hover:no-underline">
      <span className="flex min-w-0 items-center gap-3">
        <span className="truncate text-base font-semibold">{title}</span>
        <Badge variant="secondary">{formatNumber(count)}</Badge>
      </span>
    </AccordionTrigger>
    <AccordionContent>{children}</AccordionContent>
  </AccordionItem>
);

const Reports = () => {
  const { accessToken } = useAuth();
  const [report, setReport] = useState<ConversationReportsResponse>(emptyReport);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [usernameOptions, setUsernameOptions] = useState<string[]>([]);
  const [channelFilter, setChannelFilter] = useState(ALL_VALUE);
  const [sentimentFilter, setSentimentFilter] = useState(ALL_VALUE);
  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE);
  const [usernameFilter, setUsernameFilter] = useState(ALL_VALUE);
  const [periodFilter, setPeriodFilter] = useState(ALL_VALUE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportParams = useMemo(
    () => ({
      source: channelFilter === ALL_VALUE ? undefined : channelFilter,
      sentiment: sentimentFilter === ALL_VALUE ? undefined : sentimentFilter,
      category: categoryFilter === ALL_VALUE ? undefined : categoryFilter,
      username: usernameFilter === ALL_VALUE ? undefined : usernameFilter,
      ...periodParams(periodFilter),
    }),
    [categoryFilter, channelFilter, periodFilter, sentimentFilter, usernameFilter]
  );

  const rememberReportOptions = useCallback((nextReport: ConversationReportsResponse) => {
    setCategoryOptions((current) => mergeOptions(current, reportCategories(nextReport)));
    setUsernameOptions((current) => mergeOptions(current, reportUsernames(nextReport)));
  }, []);

  const loadReport = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const data = await ConversationsApi.getReports(reportParams);
      const nextReport = unwrapReport(data as ReportEnvelope);
      setReport(nextReport);
      rememberReportOptions(nextReport);
      setError(null);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }, [accessToken, rememberReportOptions, reportParams]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const clearFilters = () => {
    setChannelFilter(ALL_VALUE);
    setSentimentFilter(ALL_VALUE);
    setCategoryFilter(ALL_VALUE);
    setUsernameFilter(ALL_VALUE);
    setPeriodFilter(ALL_VALUE);
  };

  const activeFilterCount = [
    channelFilter,
    sentimentFilter,
    categoryFilter,
    usernameFilter,
    periodFilter,
  ].filter((value) => value !== ALL_VALUE).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reports</h2>
          <p className="text-muted-foreground">Conversation cases by sentiment, category, channel, and handler</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} filters</Badge>}
          <Button type="button" variant="outline" onClick={clearFilters} disabled={loading || activeFilterCount === 0}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={loadReport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Channel</div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All channels</SelectItem>
                {SUPPORTED_CHANNELS.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Sentiment</div>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sentimentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Category</div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Handled by</div>
            <Select value={usernameFilter} onValueChange={setUsernameFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All usernames</SelectItem>
                {usernameOptions.map((username) => (
                  <SelectItem key={username} value={username}>
                    {username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Period</div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-destructive">
            <BarChart3 className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TotalCard label="Total cases" value={report.totalCases} />
        <TotalCard label="Positive cases" value={report.positiveCases} tone="positive" />
        <TotalCard label="Negative cases" value={report.negativeCases} tone="negative" />
        <TotalCard label="Neutral cases" value={report.neutralCases} tone="neutral" />
      </div>

      {loading && report.totalCases === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reports
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={["sentiment"]} className="space-y-3">
          <ReportSection
            value="sentiment"
            title="Category by sentiment"
            count={report.positiveByCategory.length + report.negativeByCategory.length}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <CategoryTable title="Positive by Category" rows={report.positiveByCategory} />
              <CategoryTable title="Negative by Category" rows={report.negativeByCategory} />
            </div>
          </ReportSection>

          <ReportSection value="channel" title="Cases by channel" count={report.byChannel.length}>
            <ChannelTable rows={report.byChannel} />
          </ReportSection>

          <ReportSection
            value="channel-category"
            title="Category by channel"
            count={report.byChannelAndCategory.length}
          >
            <ChannelCategoryTable rows={report.byChannelAndCategory} />
          </ReportSection>

          <ReportSection
            value="handled"
            title="Handled by username"
            count={report.handledByUsernameCategoryChannel.length}
          >
            <HandledTable rows={report.handledByUsernameCategoryChannel} />
          </ReportSection>
        </Accordion>
      )}
    </div>
  );
};

export default Reports;
