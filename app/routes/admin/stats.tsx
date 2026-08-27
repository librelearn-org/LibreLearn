import { useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Progress, Space } from "@siemsiem/beerreact";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
} from "recharts";
import { useTRPC } from "~/utils/trpc/react";
import { getSubjectBySlug } from "~/components/Icons";

const COLORS = [
    "#076745",
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#64748b"
];

const FORMAT_LABELS: Record<string, string> = {
    toets: "Toets",
    leren: "Leren",
    gedachten: "Gedachten",
};

export default function AdminStats() {
    const trpc = useTRPC();
    const { data: stats, isLoading, error, refetch, isFetching } = useQuery(
        trpc.admin.veryCoolAdminStats.queryOptions()
    );

    const subjectChartData = stats?.vakkenData?.map((item) => {
        const subject = getSubjectBySlug(item.language);
        return {
            name: subject?.name ? subject.name.replace("icons:", "") : item.language.toUpperCase(),
            language: item.language.toUpperCase(),
            lijsten: item.count,
        };
    }) ?? [];

    const subjectWordsChartData = stats?.vakkenData?.map((item) => {
        const subject = getSubjectBySlug(item.language);
        return {
            name: subject?.name ? subject.name.replace("icons:", "") : item.language.toUpperCase(),
            language: item.language.toUpperCase(),
            woorden: item.woorden ?? item.wordsCount ?? 0,
        };
    }) ?? [];


    const formatChartData = stats?.learnFormats?.map((item) => ({
        name: FORMAT_LABELS[item.format] ?? item.format,
        sessies: item.count,
    })) ?? [];

    const activeUsers = Math.max(0, (stats?.users ?? 0) - (stats?.bannedUsers ?? 0));
    const userStatusData = [
        { name: "Actief", value: stats?.activeUsers ?? 0, color: "#10b981" },
        { name: "Inactief", value: stats?.inactiveUsers ?? 0, color: "#64748b" },
        ...(stats?.bannedUsers ? [{ name: "Verbannen", value: stats.bannedUsers, color: "#ef4444" }] : []),
    ].filter((d) => d.value > 0 || (stats?.users ?? 0) === 0);
    return (
        <div className="padding">
            <div className="row" >
                <div className="max">
                    <h2>Statistieken</h2>
                </div>
                <div>
                    <Button
                        variant="transparent"
                        icon="refresh"
                        onClick={() => refetch()}
                        disabled={isFetching}
                    >
                        Vernieuwen
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="center-align padding">
                    <Progress />
                    <p>Statistieken laden...</p>
                </div>
            ) : error ? (
                <Card>
                    <h5>Fout bij het laden van statistieken</h5>
                    <p>{error.message}</p>
                </Card>
            ) : (
                <>
                    {/* Key Metrics Cards */}
                    <div className="grid">
                        <div className="s12 m6 l4">
                            <Card className="padding">
                                <div className="row vertical center-align">
                                    <div className="row center-align small-space middle-align">

                                        <i className="extra">group</i>
                                        <h6 className="opacity-70">Totaal gebruikers</h6>
                                    </div>
                                    <h3>{stats?.users ?? 0}</h3>

                                </div>
                            </Card>
                        </div>
                        <div className="s12 m6 l4">
                            <Card className="padding">
                                <div className="row vertical center-align">
                                    <div className="row center-align small-space middle-align">
                                        <i className="extra">list_alt</i>
                                        <h6 className="opacity-70">Totaal lijsten</h6>
                                    </div>
                                    <h3>{stats?.totalLists ?? 0}</h3>
                                </div>
                            </Card>
                        </div>
                        <div className="s12 m6 l4">
                            <Card className="padding">
                                <div className="row vertical center-align">
                                    <div className="row center-align small-space middle-align">
                                        <i className="extra">translate</i>
                                        <h6 className="opacity-70">Opgeslagen woorden</h6>
                                    </div>

                                    <h3>{stats?.woordenData ?? 0}</h3>
                                </div>
                            </Card>
                        </div>

                        {/* </div>
                    <Space></Space>

                    {/* Charts Section */}
                        {/* <div className="grid">  */}
                        {/* Bar Chart: Lists per Subject */}
                        <div className="s12 l8">
                            <Card className="padding">
                                <h4>Lijsten per taal / vak</h4>
                                {subjectChartData.length > 0 ? (
                                    <div style={{ width: "100%", height: 320, marginTop: "1rem" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={subjectChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis dataKey="name" />
                                                <YAxis allowDecimals={false} />
                                                <Bar dataKey="lijsten" name="" fill="#076745" radius={[6, 6, 0, 0]}>
                                                    {subjectChartData.map((_, index) => (
                                                        <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>

                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="opacity-70 padding">Geen lijstgegevens beschikbaar.</p>
                                )}
                            </Card>
                        </div>
                        <div className="s12 l4">
                            <Card className="padding">
                                <h4>Verdeling woorden</h4>
                                {subjectWordsChartData.length > 0 ? (
                                    <div style={{ width: "100%", height: 320, marginTop: "1rem" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={subjectWordsChartData}
                                                    dataKey="woorden"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={95}
                                                    innerRadius={45}
                                                    paddingAngle={3}
                                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                                >
                                                    {subjectWordsChartData.map((_, index) => (
                                                        <Cell key={`pie-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                    <Legend />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="opacity-70 padding">Geen woord gegevens beschikbaar.</p>
                                )}
                            </Card>
                        </div>

                        <div className="s12 m6">
                            <Card className="padding">
                                <h4>Leersessie formats</h4>
                                {formatChartData.length > 0 ? (
                                    <div style={{ width: "100%", height: 260, marginTop: "1rem" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={formatChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis dataKey="name" />
                                                <YAxis allowDecimals={false} />
                                                <Bar dataKey="sessies" name="Sessies" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                                                    {formatChartData.map((_, index) => (
                                                        <Cell key={`format-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="opacity-70 padding">Geen leersessies geregistreerd.</p>
                                )}
                            </Card>
                        </div>

                        {/* User Status Chart */}
                        <div className="s12 m6">
                            <Card className="padding">
                                <h4>Gebruikersstatus</h4>
                                {(stats?.users ?? 0) > 0 ? (
                                    <div style={{ width: "100%", height: 260, marginTop: "1rem" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={userStatusData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    innerRadius={40}
                                                    paddingAngle={4}
                                                    label={({ name, value }) => `${name}: ${value}`}
                                                >
                                                    {userStatusData.map((entry, index) => (
                                                        <Cell key={`user-cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="opacity-70 padding">Geen gebruikers geregistreerd.</p>
                                )}
                            </Card>
                        </div>

                        <div className="s12 l4">
                            <Card className="padding">
                                <h4>Verdeling lijsten per vak</h4>
                                {subjectChartData.length > 0 ? (
                                    <div style={{ width: "100%", height: 270, marginTop: "1rem" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={subjectChartData}
                                                    dataKey="lijsten"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={95}
                                                    innerRadius={45}
                                                    paddingAngle={3}
                                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                                >
                                                    {subjectChartData.map((_, index) => (
                                                        <Cell key={`pie-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Legend />

                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="opacity-70 padding">Geen vakgegevens beschikbaar.</p>
                                )}
                            </Card>
                        </div>


                        <div className="grid l8 m6">

                            <div className="s12 l6">
                                <Card className="padding">
                                    <div className="row vertical center-align">
                                        <i className="extra">school</i>
                                        <h6 className="opacity-70">Leersessies</h6>
                                        <h3>{stats?.totalLearnSessions ?? 0}</h3>
                                    </div>
                                </Card>
                            </div>
                            <div className="s12 l6">
                                <Card className="padding">
                                    <div className="row vertical center-align">
                                        <i className="extra">block</i>
                                        <h6 className="opacity-70">Verbannen gebruikers</h6>
                                        <h3>{stats?.bannedUsers ?? 0}</h3>
                                    </div>
                                </Card>
                            </div>
                            <div className="s12 l6">
                                <Card className="padding">
                                    <div className="row vertical center-align">
                                        <i className="extra">skull</i>
                                        <h6 className="opacity-70">Inactive gebruikers</h6>
                                        <h3>{stats?.inactiveUsers ?? 0}</h3>
                                    </div>
                                </Card>
                            </div>
                            <div className="s12 l6">
                                <Card className="padding">
                                    <div className="row vertical center-align">
                                        <i className="extra">check</i>
                                        <h6 className="opacity-70">Active gebruikers</h6>
                                        <h3>{stats?.activeUsers ?? 0}</h3>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
