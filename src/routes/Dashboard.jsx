import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Spinner,
    Chip,
    Input,
    Accordion,
    AccordionItem,
} from "@heroui/react";
import { 
    Calendar, 
    Users, 
    Trophy, 
    BarChart2, 
    Hash, 
    Gavel, 
    Plus, 
    Clock, 
    ExternalLink,
    Search,
    Radio,
    FileText,
    Archive,
    CheckCircle,
    PauseCircle,
    ChevronRight,
} from "lucide-react";
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false); // Start false, will show authLoading instead
    const [stats, setStats] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const canCreate = profile && ["admin", "club_coordinator"].includes(profile.role);
    const isAdmin = profile && profile.role === "admin";
    const isViewer = profile && profile.role === "viewer";

    // Keep HEAD Logic: useCallback wrapper for fetching
    const fetchDashboardData = useCallback(async (showLoading = true) => {
        // Early return if auth is still loading
        if (authLoading) {
            return;
        }
        
        // If auth is done but no user/profile, stop loading
        if (!user?.id || !profile?.role) {
            setLoading(false);
            return;
        }
        
        if (showLoading) setLoading(true);

        try {
            const baseEventsQuery = supabase
                .from('events')
                .select('id, name, type, event_types, visibility, status, created_at')
                .order('created_at', { ascending: false });

            const [created, judged] = await Promise.all([
                isAdmin
                    ? baseEventsQuery
                    : isViewer
                        ? baseEventsQuery.eq("visibility", "public")
                        : baseEventsQuery.or(`created_by.eq.${user.id},visibility.eq.public`),
                supabase
                    .from("event_judges")
                    .select("event_id")
                    .eq("user_id", user.id),
            ]);

            const ids = new Set((created.data || []).map((e) => e.id));
            for (const j of judged.data || []) {
                if (!ids.has(j.event_id)) ids.add(j.event_id);
            }
            
            const extra = [...ids].filter(
                (x) => !(created.data || []).some((e) => e.id === x),
            );

            let more = [];
            if (extra.length) {
                const { data } = await supabase
                    .from("events")
                    .select("id, name, type, event_types, visibility, status, created_at")
                    .in("id", extra);
                more = data || [];
            }

            const merged = [...(created.data || []), ...more];
            merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setEvents(merged);

            if (isAdmin) {
                const [
                    eventsCount,
                    teamsCount,
                    matchesCount,
                    pollsCount,
                    votesCount,
                    judgesCount,
                    openPollsCount,
                ] = await Promise.all([
                    supabase.from('events').select('id', { count: 'exact', head: true }),
                    supabase.from('teams').select('id', { count: 'exact', head: true }),
                    supabase.from('matches').select('id', { count: 'exact', head: true }),
                    supabase.from('polls').select('id', { count: 'exact', head: true }),
                    supabase.from('votes').select('id', { count: 'exact', head: true }),
                    supabase.from('event_judges').select('event_id', { count: 'exact', head: true }),
                    supabase.from('polls').select('id', { count: 'exact', head: true }).eq('status', 'open'),
                ]);

                setStats({
                    events: eventsCount.count || 0,
                    teams: teamsCount.count || 0,
                    matches: matchesCount.count || 0,
                    polls: pollsCount.count || 0,
                    votes: votesCount.count || 0,
                    judges: judgesCount.count || 0,
                    openPolls: openPollsCount.count || 0,
                });
            }
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, profile?.role, isAdmin, isViewer, authLoading]);

    useEffect(() => {
        fetchDashboardData(true);
    }, [fetchDashboardData]);

    // Filter events by search query
    const filteredEvents = useMemo(() => {
        if (!searchQuery.trim()) return events;
        const query = searchQuery.toLowerCase();
        return events.filter(e => 
            e.name.toLowerCase().includes(query) ||
            e.type?.toLowerCase().includes(query) ||
            (Array.isArray(e.event_types) && e.event_types.some(t => t.toLowerCase().includes(query)))
        );
    }, [events, searchQuery]);

    // Group events by status
    const groupedEvents = useMemo(() => {
        const groups = {
            live: [],
            registration_open: [],
            registration_closed: [],
            draft: [],
            completed: [],
            archived: [],
        };
        
        filteredEvents.forEach(e => {
            const status = e.status || 'draft';
            if (groups[status]) {
                groups[status].push(e);
            } else {
                groups.draft.push(e);
            }
        });
        
        return groups;
    }, [filteredEvents]);

    // Status configuration for display
    const statusConfig = {
        live: { label: 'Live Events', icon: Radio, color: 'success', description: 'Currently running events' },
        registration_open: { label: 'Registration Open', icon: Users, color: 'primary', description: 'Accepting registrations' },
        registration_closed: { label: 'Registration Closed', icon: PauseCircle, color: 'warning', description: 'Registrations closed, not yet live' },
        draft: { label: 'Draft Events', icon: FileText, color: 'default', description: 'Events in preparation' },
        completed: { label: 'Completed Events', icon: CheckCircle, color: 'secondary', description: 'Finished events' },
        archived: { label: 'Archived Events', icon: Archive, color: 'default', description: 'Old archived events' },
    };

    // Get sections that have events
    const activeSections = Object.entries(groupedEvents)
        .filter(([_, events]) => events.length > 0)
        .map(([status]) => status);

    // UI kept from Remote
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-default-500">
                        Welcome back, {profile?.display_name || "User"}
                    </h1>
                    <p className="text-default-500 mt-1 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                        Role:{" "}
                        <span className="font-semibold capitalize">
                            {profile?.role?.replace("_", " ") ?? "Guest"}
                        </span>
                    </p>
                </div>
                {canCreate && (
                    <Button
                        as={Link}
                        to="/events/new"
                        color="primary"
                        size="lg"
                        className="font-semibold shadow-lg shadow-primary/20"
                        startContent={<Plus className="w-5 h-5" />}
                    >
                        Create Event
                    </Button>
                )}
            </div>

            {isAdmin && stats && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold opacity-80">System Analytics</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        <StatCard label="Events" value={stats.events} icon={Calendar} color="primary" />
                        <StatCard label="Teams" value={stats.teams} icon={Users} color="secondary" />
                        <StatCard label="Judges" value={stats.judges} icon={Gavel} color="warning" />
                        <StatCard label="Matches" value={stats.matches} icon={Trophy} color="success" />
                        <StatCard label="Polls" value={stats.polls} icon={BarChart2} color="danger" />
                        <StatCard label="Active" value={stats.openPolls} icon={Clock} color="primary" />
                        <StatCard label="Votes" value={stats.votes} icon={Hash} color="secondary" />
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold">
                        {isViewer ? "Public Events" : "Your Events"}
                    </h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Input
                            placeholder="Search events..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            startContent={<Search size={18} className="text-default-400" />}
                            isClearable
                            onClear={() => setSearchQuery('')}
                            className="w-full sm:w-64"
                            size="sm"
                        />
                        <span className="text-default-400 text-sm whitespace-nowrap">
                            {filteredEvents.length} events
                        </span>
                    </div>
                </div>

                {(loading || authLoading) ? (
                    <div className="flex justify-center py-24">
                        <Spinner size="lg" />
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-default-200 rounded-2xl">
                        <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-default-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            {searchQuery ? "No events found" : "No events yet"}
                        </h3>
                        <p className="text-default-500 mb-6 max-w-sm mx-auto">
                            {searchQuery
                                ? `No events match "${searchQuery}". Try a different search.`
                                : canCreate
                                    ? "Get started by creating your first event to manage brackets, polls, and more."
                                    : "Check back later for public events."}
                        </p>
                        {!searchQuery && canCreate && (
                            <Button as={Link} to="/events/new" color="primary" variant="flat">
                                Create Event
                            </Button>
                        )}
                    </div>
                ) : (
                    <Accordion 
                        variant="splitted" 
                        selectionMode="multiple"
                        defaultExpandedKeys={activeSections.slice(0, 2)}
                        className="px-0"
                    >
                        {Object.entries(groupedEvents).map(([status, statusEvents]) => {
                            if (statusEvents.length === 0) return null;
                            const config = statusConfig[status];
                            const Icon = config.icon;
                            
                            return (
                                <AccordionItem
                                    key={status}
                                    aria-label={config.label}
                                    startContent={
                                        <div className={`p-2 rounded-lg bg-${config.color}/10`}>
                                            <Icon size={20} className={`text-${config.color}`} />
                                        </div>
                                    }
                                    title={
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold">{config.label}</span>
                                            <Chip size="sm" variant="flat" color={config.color}>
                                                {statusEvents.length}
                                            </Chip>
                                        </div>
                                    }
                                    subtitle={config.description}
                                    classNames={{
                                        base: "group-[.is-splitted]:shadow-sm",
                                        content: "pt-2",
                                    }}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                                        {statusEvents.map((e) => (
                                            <EventCard key={e.id} event={e} />
                                        ))}
                                    </div>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}
            </div>
        </div>
    );
}

function EventCard({ event: e }) {
    const statusColors = {
        live: 'success',
        registration_open: 'primary',
        registration_closed: 'warning',
        draft: 'default',
        completed: 'secondary',
        archived: 'default',
    };

    return (
        <Card
            as={Link}
            to={`/events/${e.id}`}
            isPressable
            className="group border border-transparent hover:border-primary/20 hover:scale-[1.02] transition-all duration-200"
        >
            <CardHeader className="flex justify-between items-start pb-0">
                <div className="flex gap-2 mb-2 flex-wrap">
                    <Chip
                        size="sm"
                        color={e.visibility === "public" ? "success" : "default"}
                        variant="flat"
                        className="capitalize"
                    >
                        {e.visibility}
                    </Chip>
                    <Chip
                        size="sm"
                        variant="dot"
                        color={statusColors[e.status] || 'default'}
                        className="capitalize border-none"
                    >
                        {(e.status || 'draft').replace('_', ' ')}
                    </Chip>
                </div>
            </CardHeader>
            <CardBody className="py-4">
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                    {e.name}
                </h3>
                <div className="flex flex-wrap gap-1">
                    {Array.isArray(e.event_types) && e.event_types.map((t) => (
                        <span key={t} className="text-xs px-2 py-1 rounded bg-default-100 text-default-500">
                            {t}
                        </span>
                    ))}
                </div>
            </CardBody>
            <CardFooter className="pt-0">
                <div className="text-xs text-default-400 flex items-center gap-1">
                    Created {new Date(e.created_at).toLocaleDateString()}
                </div>
                <ExternalLink className="w-4 h-4 ml-auto text-default-300 group-hover:text-primary" />
            </CardFooter>
        </Card>
    );
}

function StatCard({ label, value, icon: Icon, color = "default" }) {
    const colorClasses = {
        primary: "bg-primary/10 text-primary",
        secondary: "bg-secondary/10 text-secondary",
        warning: "bg-warning/10 text-warning",
        success: "bg-success/10 text-success",
        danger: "bg-danger/10 text-danger",
        default: "bg-default/10 text-default-600",
    };

    return (
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-4 flex flex-col items-center justify-center gap-2">
                <div className={`p-2 rounded-full ${colorClasses[color] || colorClasses.default}`}>
                    {Icon ? <Icon className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-default-500 uppercase tracking-wider font-medium">
                        {label}
                    </p>
                </div>
            </CardBody>
        </Card>
    );
}