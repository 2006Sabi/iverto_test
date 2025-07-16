import { useEffect, useMemo, useState } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAppSelector } from "@/store/hooks";
import {
  useCameras,
  useRecentAnomalies,
  useRealtimeAnomalies,
} from "@/hooks/useReduxData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { ListItemSkeleton } from "@/components/ui/loading";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Customized,
} from "recharts";
import {
  useGetAnomalyGraphDataQuery,
  useGetAnomalyPieDataQuery,
} from "@/store/api/anomalyApi";
import GanttChart from "@/components/GanttChart";
import RecentAnomaliesList from "@/components/RecentAnomaliesList";
import PieChartInlineLabel from "@/components/PieChartInlineLabel";
import { useIsMobile } from "@/hooks/use-mobile";
import type { XAxisMap } from "recharts/types/util/types";
import { getMonthName } from "@/utils/chartUtils";

interface MonthLabelsProps {
  xAxisMap: XAxisMap;
  height: number;
  data: { date: string }[];
}

function isScaleFunction(scale: any): scale is (val: any) => number {
  return typeof scale === "function";
}

function MonthLabels(props: MonthLabelsProps) {
  const { xAxisMap, height, data } = props;
  const xAxis = xAxisMap[Object.keys(xAxisMap)[0]];
  const ticks = xAxis?.ticks || [];
  if (!ticks.length) return null;
  const scale = xAxis?.scale;
  if (!isScaleFunction(scale)) return null;

  // Group ticks by month
  let groups: { month: string; start: number; end: number }[] = [];
  let lastMonth: string | null = null;
  let groupStart = 0;

  for (let i = 0; i < ticks.length; i++) {
    const month = getMonthName(data[i].date);
    if (month !== lastMonth) {
      if (lastMonth !== null) {
        groups.push({ month: lastMonth, start: groupStart, end: i - 1 });
      }
      lastMonth = month;
      groupStart = i;
    }
  }
  if (lastMonth !== null) {
    groups.push({ month: lastMonth, start: groupStart, end: ticks.length - 1 });
  }

  // Render month labels
  return (
    <g>
      {groups.map((group, idx) => {
        const startX = scale(ticks[group.start]);
        const endX = scale(ticks[group.end]);
        const midX = (startX + endX) / 2;
        return (
          <text
            key={group.month + idx}
            x={midX}
            y={height + 40}
            textAnchor="middle"
            fontSize={10}
            fontWeight="500"
            fill="#6b7280"
            className="font-medium select-none"
          >
            {group.month}
          </text>
        );
      })}
    </g>
  );
}

const Dashboard = () => {
  const { connectionStatus, isConnected } = useWebSocket();
  const { latestAnomalies } = useRealtimeAnomalies();
  const { data: cameras, loading: camerasLoading } = useCameras();
  const { data: recentAnomalies, loading: anomaliesLoading } =
    useRecentAnomalies();

  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPieSlice, setSelectedPieSlice] = useState<string | null>(null);

  // Fetch comprehensive anomaly graph data from API
  const { data: comprehensiveGraphData, isLoading: graphLoading } =
    useGetAnomalyGraphDataQuery();

  // Fetch pie chart data from API
  const { data: pieData, isLoading: pieLoading } = useGetAnomalyPieDataQuery();

  const mergedCameras = useMemo(() => {
    if (!cameras) return [];
    return cameras.map((camera) => ({ ...camera, status: camera.status }));
  }, [cameras]);

  const mergedAnomalies = useMemo(() => {
    const realtimeAnomalies = latestAnomalies.slice(0, 4);
    return realtimeAnomalies.length > 0
      ? realtimeAnomalies
      : recentAnomalies || [];
  }, [latestAnomalies, recentAnomalies]);

  // Transform comprehensive API data for chart
  const chartData = useMemo(() => {
    if (!comprehensiveGraphData?.graphData) return [];

    return Object.entries(comprehensiveGraphData.graphData)
      .map(([date, entry]) => ({
        date,
        anomalies: entry.count,
      }))
      .sort((a, b) => {
        // Convert DD-MM-YYYY to YYYY-MM-DD for proper sorting
        const dateA = a.date.split("-").reverse().join("-");
        const dateB = b.date.split("-").reverse().join("-");
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  }, [comprehensiveGraphData]);

  // Transform pie data for chart
  const pieChartData = useMemo(() => {
    if (!recentAnomalies || !Array.isArray(recentAnomalies)) return [];
    // Only include anomalies from the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const filtered = recentAnomalies.filter((anomaly) => {
      const anomalyDate = new Date(anomaly.timestamp || anomaly.created_at);
      return anomalyDate >= thirtyDaysAgo && anomalyDate <= now;
    });
    // Aggregate by type
    const typeCounts: { [type: string]: number } = {};
    filtered.forEach((anomaly) => {
      typeCounts[anomaly.type] = (typeCounts[anomaly.type] || 0) + 1;
    });
    const colors = [
      "#cd0447",
      "#f59e0b",
      "#10b981",
      "#8b5cf6",
      "#3b82f6",
      "#ef4444",
    ];
    return Object.entries(typeCounts).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  }, [recentAnomalies]);

  // Generate camera tasks from comprehensive data
  const cameraTasks = useMemo(() => {
    if (!comprehensiveGraphData?.graphData) return {};

    const tasks: { [date: string]: any[] } = {};

    Object.entries(comprehensiveGraphData.graphData).forEach(
      ([date, entry]) => {
        if (entry.anomalies.length > 0) {
          tasks[date] = entry.anomalies.map((anomaly) => ({
            camera: anomaly.camera.name,
            start: `${date} ${new Date(anomaly.timestamp).toLocaleTimeString(
              "en-US",
              {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              }
            )}`,
            end: `${date} ${new Date(
              new Date(anomaly.timestamp).getTime() +
                parseInt(anomaly.duration.split(":")[0]) * 60 * 60 * 1000 +
                parseInt(anomaly.duration.split(":")[1]) * 60 * 1000
            ).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            })}`,
            type: anomaly.type,
            status: anomaly.status,
          }));
        }
      }
    );

    return tasks;
  }, [comprehensiveGraphData]);

  // Generate recent anomalies data from comprehensive data
  const recentAnomaliesData = useMemo(() => {
    if (!comprehensiveGraphData?.graphData) {
      return { today: [], yesterday: [], lastWeek: [], lastMonth: [] };
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const result = {
      today: [] as any[],
      yesterday: [] as any[],
      lastWeek: [] as any[],
      lastMonth: [] as any[],
    };

    Object.entries(comprehensiveGraphData.graphData).forEach(
      ([date, entry]) => {
        const anomalyDate = new Date(date.split("-").reverse().join("-"));

        entry.anomalies.forEach((anomaly) => {
          const anomalyItem = {
            type: anomaly.type,
            time: new Date(anomaly.timestamp).toLocaleTimeString("en-US", {
              hour12: true,
              hour: "2-digit",
              minute: "2-digit",
            }),
            camera: anomaly.camera.name,
            id: anomaly._id,
          };

          if (date === todayStr) {
            result.today.push(anomalyItem);
          } else if (date === yesterdayStr) {
            result.yesterday.push(anomalyItem);
          } else if (anomalyDate >= lastWeek) {
            result.lastWeek.push(anomalyItem);
          } else if (anomalyDate >= lastMonth) {
            result.lastMonth.push(anomalyItem);
          }
        });
      }
    );

    return result;
  }, [comprehensiveGraphData]);

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      setSelectedDate(data.activePayload[0].payload.date);
    }
  };

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      setSelectedPieSlice(data.name);
    }
  };

  // Helper function to format date from DD-MM-YYYY to readable format
  const formatDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split("-");
    return new Date(`${year}-${month}-${day}`).toLocaleDateString();
  };

  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-gray-50 to-blue-100">
        {/* Responsive Sidebar: Drawer for mobile/tablet, static for desktop */}
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Responsive Header */}
          <header className="flex h-12 sm:h-14 items-center gap-2 sm:gap-4 border-b border-gray-200 px-2 sm:px-4 md:px-6 lg:px-8 bg-white shadow-sm">
            <div className="flex-1" />
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full font-medium text-xs shadow-inner transition-colors ${
                  isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isConnected ? (
                  <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <WifiOff className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden sm:inline">
                  {connectionStatus === "connected" ? "Live" : connectionStatus}
                </span>
              </div>
            </div>
          </header>

          {/* Responsive Main Content */}
          <main className="flex-1 overflow-auto p-2 sm:p-3 md:p-4 lg:p-6">
            {/* Mobile: Stack layout, Desktop: Grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 h-full">
              {/* Left Column - Charts (Mobile: Full width, Desktop: 8 columns) */}
              <div className="lg:col-span-8 flex flex-col gap-3 sm:gap-4 md:gap-6">
                {/* Anomaly Chart - Responsive with horizontal scroll on mobile */}
                <Card className="modern-card bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-2 sm:pb-3 md:pb-4">
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm sm:text-base md:text-lg font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 sm:p-2 rounded-xl bg-red-100">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-red-700" />
                        </div>
                        <span className="text-xs sm:text-sm md:text-base">
                          Anomalies by Date (Last 30 Days)
                        </span>
                      </div>
                      {selectedDate && (
                        <Badge
                          variant="secondary"
                          className="badge-responsive text-xs sm:text-sm"
                        >
                          Selected: {formatDate(selectedDate)}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 md:px-4 pb-2 sm:pb-3 md:pb-4">
                    {/* Mobile: Fixed height with scroll, Desktop: Responsive height */}
                    <div className="h-[250px] sm:h-[300px] md:h-[350px] lg:h-[400px]">
                      {graphLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-3 border-red-600"></div>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartData}
                            onClick={handleChartClick}
                            margin={{
                              top: 10,
                              right: 10,
                              left: 5,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e5e7eb"
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(value) => {
                                return value.split("-")[0];
                              }}
                              interval={isMobile ? 2 : 0}
                              angle={0}
                              textAnchor="middle"
                              height={40}
                              tick={{
                                fontSize: isMobile ? 8 : 10,
                                fill: "#374151",
                              }}
                              axisLine={{ stroke: "#d1d5db" }}
                              tickLine={{ stroke: "#d1d5db" }}
                            />
                            <YAxis
                              tick={{
                                fontSize: isMobile ? 8 : 10,
                                fill: "#374151",
                              }}
                              axisLine={{ stroke: "#d1d5db" }}
                              tickLine={{ stroke: "#d1d5db" }}
                            />
                            <Tooltip
                              labelFormatter={(value) => formatDate(value)}
                              formatter={(value, name) => [value, "Anomalies"]}
                              contentStyle={{
                                fontSize: isMobile ? "12px" : "14px",
                                padding: isMobile ? "8px" : "12px",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="anomalies"
                              stroke="#cd0447"
                              strokeWidth={isMobile ? 1.5 : 2}
                              dot={{
                                fill: "#cd0447",
                                strokeWidth: 1,
                                r: isMobile ? 3 : 4,
                              }}
                              activeDot={{
                                r: isMobile ? 4 : 6,
                                stroke: "#cd0447",
                                strokeWidth: 2,
                              }}
                            />
                            <Customized
                              component={(props: any) => (
                                <MonthLabels
                                  xAxisMap={props.xAxisMap}
                                  height={props.height}
                                  data={chartData}
                                />
                              )}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Gantt Chart - Responsive with horizontal scroll on mobile */}
                <div className="overflow-x-auto">
                  <div className="min-w-[600px] sm:min-w-[800px] lg:min-w-[900px]">
                    <GanttChart
                      selectedDate={selectedDate}
                      cameraTasks={cameraTasks}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Pie Chart and Recent Anomalies (Mobile: Full width, Desktop: 4 columns) */}
              <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4 md:gap-6">
                {/* Pie Chart - Responsive */}
                <Card className="modern-card bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow flex-1">
                  <CardContent className="flex items-center justify-center w-full h-full p-3 sm:p-4 md:p-6">
                    <div className="w-full h-full min-h-[200px] sm:min-h-[250px] md:min-h-[300px]">
                      {pieLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-500"></div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <PieChartInlineLabel data={pieChartData} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Anomalies List - Responsive */}
                <div className="flex-1">
                  <RecentAnomaliesList anomalies={recentAnomaliesData} />
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
