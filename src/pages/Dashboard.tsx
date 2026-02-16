import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Mitarbeiter, Werkzeuge, Wartung, Projekte, Werkzeugzuweisung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { toast } from 'sonner';
import { format, parseISO, isBefore, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wrench, Users, FolderKanban, ClipboardCheck, ArrowLeftRight,
  Plus, Pencil, Trash2, AlertCircle, Search, ChevronRight, RotateCcw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Lookup label maps ───
const ABTEILUNG_LABELS: Record<string, string> = {
  wartung_service: 'Wartung und Service', planung: 'Planung',
  elektroinstallation: 'Elektroinstallation', verwaltung: 'Verwaltung', lager: 'Lager',
};
const KATEGORIE_LABELS: Record<string, string> = {
  handwerkzeuge: 'Handwerkzeuge', messgeraete: 'Messgeräte', pruefgeraete: 'Prüfgeräte',
  leitern_gerueste: 'Leitern und Gerüste', kabel_leitungen: 'Kabel und Leitungen',
  sonstiges: 'Sonstiges', elektrowerkzeuge: 'Elektrowerkzeuge',
};
const ZUSTAND_LABELS: Record<string, string> = {
  neu: 'Neu', sehr_gut: 'Sehr gut', gut: 'Gut', befriedigend: 'Befriedigend',
  reparaturbeduerftig: 'Reparaturbedürftig', defekt: 'Defekt',
};
const ZUSTAND_PRIORITY: Record<string, number> = {
  defekt: 0, reparaturbeduerftig: 1, befriedigend: 2, gut: 3, sehr_gut: 4, neu: 5,
};
const WARTUNGSTYP_LABELS: Record<string, string> = {
  inspektion: 'Inspektion', reparatur: 'Reparatur', kalibrierung: 'Kalibrierung',
  reinigung: 'Reinigung', pruefung_dguv_v3: 'Prüfung nach DGUV V3', sonstiges: 'Sonstiges',
};

function zustandColor(z?: string): string {
  if (!z) return 'bg-muted text-muted-foreground';
  if (z === 'neu' || z === 'sehr_gut' || z === 'gut') return 'bg-emerald-100 text-emerald-700';
  if (z === 'befriedigend') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function formatDate(d?: string | null): string {
  if (!d) return '-';
  try { return format(parseISO(d.split('T')[0]), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

function formatCurrency(v?: number | null): string {
  if (v == null) return '-';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function isOverdue(d?: string | null): boolean {
  if (!d) return false;
  try {
    const date = parseISO(d.split('T')[0]);
    return isBefore(date, new Date()) && !isToday(date);
  } catch { return false; }
}

// ─── Delete Confirmation Dialog ───
function DeleteConfirm({ open, onOpenChange, name, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; name: string; onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    try {
      await onConfirm();
      toast.success(`"${name}" wurde gelöscht.`);
      onOpenChange(false);
    } catch {
      toast.error('Eintrag konnte nicht gelöscht werden.');
    } finally { setDeleting(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchtest du &quot;{name}&quot; wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90">
            {deleting ? 'Löscht...' : 'Löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ═══════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════
export default function Dashboard() {
  const [werkzeuge, setWerkzeuge] = useState<Werkzeuge[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [wartungen, setWartungen] = useState<Wartung[]>([]);
  const [projekte, setProjekte] = useState<Projekte[]>([]);
  const [zuweisungen, setZuweisungen] = useState<Werkzeugzuweisung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [w, m, wa, p, z] = await Promise.all([
        LivingAppsService.getWerkzeuge(),
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getWartung(),
        LivingAppsService.getProjekte(),
        LivingAppsService.getWerkzeugzuweisung(),
      ]);
      setWerkzeuge(w); setMitarbeiter(m); setWartungen(wa); setProjekte(p); setZuweisungen(z);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unbekannter Fehler'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Lookup maps
  const werkzeugMap = useMemo(() => {
    const m = new Map<string, Werkzeuge>();
    werkzeuge.forEach(w => m.set(w.record_id, w));
    return m;
  }, [werkzeuge]);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(ma => m.set(ma.record_id, ma));
    return m;
  }, [mitarbeiter]);

  const projektMap = useMemo(() => {
    const m = new Map<string, Projekte>();
    projekte.forEach(p => m.set(p.record_id, p));
    return m;
  }, [projekte]);

  // Active assignments
  const activeAssignments = useMemo(() =>
    zuweisungen.filter(z => !z.fields.tatsaechliche_rueckgabe)
      .sort((a, b) => {
        const aOverdue = isOverdue(a.fields.geplante_rueckgabe);
        const bOverdue = isOverdue(b.fields.geplante_rueckgabe);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return (a.fields.geplante_rueckgabe ?? '').localeCompare(b.fields.geplante_rueckgabe ?? '');
      }),
    [zuweisungen]);

  // Hero KPI calculations
  const defectiveTools = useMemo(() =>
    werkzeuge.filter(w => w.fields.zustand === 'reparaturbeduerftig' || w.fields.zustand === 'defekt'),
    [werkzeuge]);

  const overdueMaintenanceItems = useMemo(() =>
    wartungen.filter(w => isOverdue(w.fields.naechste_wartung)),
    [wartungen]);

  const overdueReturns = useMemo(() =>
    activeAssignments.filter(z => isOverdue(z.fields.geplante_rueckgabe)),
    [activeAssignments]);

  const attentionCount = defectiveTools.length + overdueMaintenanceItems.length + overdueReturns.length;

  // Assigned tool IDs
  const assignedToolIds = useMemo(() => {
    const ids = new Set<string>();
    activeAssignments.forEach(z => {
      const id = extractRecordId(z.fields.werkzeug);
      if (id) ids.add(id);
    });
    return ids;
  }, [activeAssignments]);

  const availableCount = werkzeuge.length - assignedToolIds.size - defectiveTools.length;

  // Chart data
  const zustandChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    werkzeuge.forEach(w => {
      const z = w.fields.zustand || 'unbekannt';
      counts[z] = (counts[z] || 0) + 1;
    });
    const order = ['neu', 'sehr_gut', 'gut', 'befriedigend', 'reparaturbeduerftig', 'defekt'];
    return order.filter(k => counts[k]).map(k => ({
      name: ZUSTAND_LABELS[k] || k,
      count: counts[k] || 0,
      key: k,
    }));
  }, [werkzeuge]);

  // Upcoming maintenance (sorted by next date)
  const upcomingMaintenance = useMemo(() =>
    wartungen.filter(w => w.fields.naechste_wartung)
      .sort((a, b) => {
        const aO = isOverdue(a.fields.naechste_wartung);
        const bO = isOverdue(b.fields.naechste_wartung);
        if (aO && !bO) return -1;
        if (!aO && bO) return 1;
        return (a.fields.naechste_wartung ?? '').localeCompare(b.fields.naechste_wartung ?? '');
      })
      .slice(0, 8),
    [wartungen]);

  // Dialog states
  const [zuweisungDialog, setZuweisungDialog] = useState(false);
  const [editZuweisung, setEditZuweisung] = useState<Werkzeugzuweisung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; onConfirm: () => Promise<void> } | null>(null);
  const [werkzeugDialog, setWerkzeugDialog] = useState(false);
  const [editWerkzeug, setEditWerkzeug] = useState<Werkzeuge | null>(null);
  const [wartungDialog, setWartungDialog] = useState(false);
  const [editWartung, setEditWartung] = useState<Wartung | null>(null);
  const [mitarbeiterDialog, setMitarbeiterDialog] = useState(false);
  const [editMitarbeiter, setEditMitarbeiter] = useState<Mitarbeiter | null>(null);
  const [projektDialog, setProjektDialog] = useState(false);
  const [editProjekt, setEditProjekt] = useState<Projekte | null>(null);

  // Filters
  const [werkzeugSearch, setWerkzeugSearch] = useState('');
  const [werkzeugKatFilter, setWerkzeugKatFilter] = useState('all');
  const [werkzeugZustandFilter, setWerkzeugZustandFilter] = useState('all');

  const filteredWerkzeuge = useMemo(() => {
    let list = [...werkzeuge];
    if (werkzeugSearch) {
      const s = werkzeugSearch.toLowerCase();
      list = list.filter(w => (w.fields.werkzeugname ?? '').toLowerCase().includes(s) ||
        (w.fields.hersteller ?? '').toLowerCase().includes(s) ||
        (w.fields.seriennummer ?? '').toLowerCase().includes(s));
    }
    if (werkzeugKatFilter !== 'all') list = list.filter(w => w.fields.kategorie === werkzeugKatFilter);
    if (werkzeugZustandFilter !== 'all') list = list.filter(w => w.fields.zustand === werkzeugZustandFilter);
    list.sort((a, b) => {
      const pa = ZUSTAND_PRIORITY[a.fields.zustand ?? ''] ?? 6;
      const pb = ZUSTAND_PRIORITY[b.fields.zustand ?? ''] ?? 6;
      if (pa !== pb) return pa - pb;
      return (a.fields.werkzeugname ?? '').localeCompare(b.fields.werkzeugname ?? '');
    });
    return list;
  }, [werkzeuge, werkzeugSearch, werkzeugKatFilter, werkzeugZustandFilter]);

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ───
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Fehler beim Laden</h2>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button onClick={loadAll} variant="outline"><RotateCcw className="h-4 w-4 mr-2" />Erneut versuchen</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function resolveWerkzeugName(url?: string | null): string {
    const id = extractRecordId(url);
    if (!id) return '-';
    return werkzeugMap.get(id)?.fields.werkzeugname ?? '-';
  }
  function resolveMitarbeiterName(url?: string | null): string {
    const id = extractRecordId(url);
    if (!id) return '-';
    const m = mitarbeiterMap.get(id);
    if (!m) return '-';
    return [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || '-';
  }
  function resolveProjektName(url?: string | null): string {
    const id = extractRecordId(url);
    if (!id) return '-';
    return projektMap.get(id)?.fields.projektname ?? '-';
  }

  const chartBarColor = (key: string) => {
    if (key === 'neu' || key === 'sehr_gut' || key === 'gut') return 'hsl(152 55% 42%)';
    if (key === 'befriedigend') return 'hsl(35 92% 50%)';
    return 'hsl(0 72% 51%)';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <h1 className="text-xl md:text-[28px] font-bold tracking-tight">Werkzeugmanagement</h1>
          <Button onClick={() => { setEditZuweisung(null); setZuweisungDialog(true); }}
            className="rounded-full hidden md:inline-flex">
            <ArrowLeftRight className="h-4 w-4 mr-2" />Werkzeug zuweisen
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* ─── HERO + STATS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
          {/* Hero Card */}
          <Card className="shadow-sm">
            <CardContent className="pt-6 pb-5">
              <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Handlungsbedarf</p>
              <div className="flex items-baseline gap-3">
                <span className="text-[64px] font-bold leading-none">{attentionCount}</span>
                {attentionCount > 0 && (
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-500 animate-pulse-dot" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Werkzeuge brauchen Aufmerksamkeit</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {overdueMaintenanceItems.length} Wartung fällig
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {defectiveTools.length} Defekt
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {overdueReturns.length} Rückgabe überfällig
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="flex flex-wrap lg:flex-col gap-3 lg:gap-4">
            {[
              { label: 'Gesamt', value: werkzeuge.length },
              { label: 'Zugewiesen', value: assignedToolIds.size },
              { label: 'Verfügbar', value: Math.max(0, availableCount) },
              { label: 'Reparatur', value: defectiveTools.length },
            ].map(s => (
              <div key={s.label} className="bg-muted/60 rounded-full px-4 py-2 text-center min-w-[100px]">
                <div className="text-lg font-semibold leading-tight">{s.value}</div>
                <div className="text-[13px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── TABS ─── */}
        <Tabs defaultValue="uebersicht" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="uebersicht"><Wrench className="h-4 w-4 mr-1.5" />Übersicht</TabsTrigger>
            <TabsTrigger value="werkzeuge"><Wrench className="h-4 w-4 mr-1.5" />Werkzeuge</TabsTrigger>
            <TabsTrigger value="wartung"><ClipboardCheck className="h-4 w-4 mr-1.5" />Wartung</TabsTrigger>
            <TabsTrigger value="team"><Users className="h-4 w-4 mr-1.5" />Team</TabsTrigger>
            <TabsTrigger value="projekte"><FolderKanban className="h-4 w-4 mr-1.5" />Projekte</TabsTrigger>
            <TabsTrigger value="zuweisungen"><ArrowLeftRight className="h-4 w-4 mr-1.5" />Zuweisungen</TabsTrigger>
          </TabsList>

          {/* ═══ TAB: ÜBERSICHT ═══ */}
          <TabsContent value="uebersicht">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              {/* Left column */}
              <div className="space-y-6">
                {/* Chart */}
                {zustandChartData.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Werkzeugzustand Übersicht</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={zustandChartData} layout="horizontal">
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: number) => [v, 'Anzahl']} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                              {zustandChartData.map((entry) => (
                                <Cell key={entry.key} fill={chartBarColor(entry.key)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick tool list */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Werkzeuge</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setEditWerkzeug(null); setWerkzeugDialog(true); }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {werkzeuge.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Keine Werkzeuge vorhanden.</p>
                    ) : (
                      filteredWerkzeuge.slice(0, 10).map(w => (
                        <div key={w.record_id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => { setEditWerkzeug(w); setWerkzeugDialog(true); }}>
                          <div>
                            <div className="font-medium text-[15px]">{w.fields.werkzeugname ?? '-'}</div>
                            <div className="flex gap-2 mt-0.5">
                              {w.fields.kategorie && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  {KATEGORIE_LABELS[w.fields.kategorie] ?? w.fields.kategorie}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${zustandColor(w.fields.zustand)}`}>
                                {ZUSTAND_LABELS[w.fields.zustand ?? ''] ?? '-'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Upcoming Maintenance */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Nächste Wartungen</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setEditWartung(null); setWartungDialog(true); }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {upcomingMaintenance.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Keine anstehenden Wartungen.</p>
                    ) : (
                      upcomingMaintenance.map(w => {
                        const overdue = isOverdue(w.fields.naechste_wartung);
                        return (
                          <div key={w.record_id}
                            className={`p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
                            onClick={() => { setEditWartung(w); setWartungDialog(true); }}>
                            <div className="font-medium text-sm">{resolveWerkzeugName(w.fields.werkzeug)}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {w.fields.wartungstyp && (
                                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                  {WARTUNGSTYP_LABELS[w.fields.wartungstyp] ?? w.fields.wartungstyp}
                                </span>
                              )}
                              <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                Fällig: {formatDate(w.fields.naechste_wartung)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                {/* Active Assignments */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Aktive Zuweisungen</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setEditZuweisung(null); setZuweisungDialog(true); }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {activeAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Keine aktiven Zuweisungen.</p>
                    ) : (
                      activeAssignments.slice(0, 8).map(z => {
                        const overdue = isOverdue(z.fields.geplante_rueckgabe);
                        return (
                          <div key={z.record_id}
                            className={`p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
                            onClick={() => { setEditZuweisung(z); setZuweisungDialog(true); }}>
                            <div className="font-medium text-sm">{resolveMitarbeiterName(z.fields.mitarbeiter)}</div>
                            <div className="text-xs text-muted-foreground">{resolveWerkzeugName(z.fields.werkzeug)}</div>
                            {z.fields.projekt && (
                              <div className="text-xs text-muted-foreground">{resolveProjektName(z.fields.projekt)}</div>
                            )}
                            <div className={`text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              Rückgabe: {formatDate(z.fields.geplante_rueckgabe)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: WERKZEUGE ═══ */}
          <TabsContent value="werkzeuge">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <CardTitle className="text-base">Werkzeuge ({werkzeuge.length})</CardTitle>
                  <Button size="sm" onClick={() => { setEditWerkzeug(null); setWerkzeugDialog(true); }}>
                    <Plus className="h-4 w-4 mr-1" />Neues Werkzeug
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Suchen..." className="pl-9" value={werkzeugSearch}
                      onChange={e => setWerkzeugSearch(e.target.value)} />
                  </div>
                  <Select value={werkzeugKatFilter} onValueChange={setWerkzeugKatFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kategorien</SelectItem>
                      {Object.entries(KATEGORIE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={werkzeugZustandFilter} onValueChange={setWerkzeugZustandFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Zustände</SelectItem>
                      {Object.entries(ZUSTAND_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredWerkzeuge.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Keine Werkzeuge gefunden.</p>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Kategorie</TableHead>
                            <TableHead>Hersteller</TableHead>
                            <TableHead>Zustand</TableHead>
                            <TableHead>Lagerort</TableHead>
                            <TableHead>Seriennr.</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredWerkzeuge.map(w => (
                            <TableRow key={w.record_id} className="group cursor-pointer"
                              onClick={() => { setEditWerkzeug(w); setWerkzeugDialog(true); }}>
                              <TableCell className="font-medium">{w.fields.werkzeugname ?? '-'}</TableCell>
                              <TableCell>{KATEGORIE_LABELS[w.fields.kategorie ?? ''] ?? '-'}</TableCell>
                              <TableCell>{w.fields.hersteller ?? '-'}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${zustandColor(w.fields.zustand)}`}>
                                  {ZUSTAND_LABELS[w.fields.zustand ?? ''] ?? '-'}
                                </span>
                              </TableCell>
                              <TableCell>{w.fields.lagerort ?? '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{w.fields.seriennummer ?? '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"
                                    onClick={() => { setEditWerkzeug(w); setWerkzeugDialog(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteTarget({
                                      name: w.fields.werkzeugname ?? 'Werkzeug',
                                      onConfirm: async () => { await LivingAppsService.deleteWerkzeugeEntry(w.record_id); loadAll(); }
                                    })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {filteredWerkzeuge.map(w => (
                        <div key={w.record_id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => { setEditWerkzeug(w); setWerkzeugDialog(true); }}>
                          <div>
                            <div className="font-medium">{w.fields.werkzeugname ?? '-'}</div>
                            <div className="flex gap-2 mt-1">
                              {w.fields.kategorie && (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                                  {KATEGORIE_LABELS[w.fields.kategorie]}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${zustandColor(w.fields.zustand)}`}>
                                {ZUSTAND_LABELS[w.fields.zustand ?? ''] ?? '-'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteTarget({
                                name: w.fields.werkzeugname ?? 'Werkzeug',
                                onConfirm: async () => { await LivingAppsService.deleteWerkzeugeEntry(w.record_id); loadAll(); }
                              })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: WARTUNG ═══ */}
          <TabsContent value="wartung">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Wartungen ({wartungen.length})</CardTitle>
                <Button size="sm" onClick={() => { setEditWartung(null); setWartungDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Neue Wartung
                </Button>
              </CardHeader>
              <CardContent>
                {wartungen.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Keine Wartungseinträge vorhanden.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Werkzeug</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Durchgeführt von</TableHead>
                            <TableHead>Kosten</TableHead>
                            <TableHead>Nächste Wartung</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...wartungen].sort((a, b) => (b.fields.wartungsdatum ?? '').localeCompare(a.fields.wartungsdatum ?? '')).map(w => (
                            <TableRow key={w.record_id} className="group cursor-pointer"
                              onClick={() => { setEditWartung(w); setWartungDialog(true); }}>
                              <TableCell className="font-medium">{resolveWerkzeugName(w.fields.werkzeug)}</TableCell>
                              <TableCell>
                                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                  {WARTUNGSTYP_LABELS[w.fields.wartungstyp ?? ''] ?? '-'}
                                </span>
                              </TableCell>
                              <TableCell>{formatDate(w.fields.wartungsdatum)}</TableCell>
                              <TableCell>{w.fields.durchgefuehrt_von ?? '-'}</TableCell>
                              <TableCell>{formatCurrency(w.fields.kosten)}</TableCell>
                              <TableCell>
                                <span className={isOverdue(w.fields.naechste_wartung) ? 'text-red-600 font-medium' : ''}>
                                  {formatDate(w.fields.naechste_wartung)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"
                                    onClick={() => { setEditWartung(w); setWartungDialog(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteTarget({
                                      name: `Wartung ${resolveWerkzeugName(w.fields.werkzeug)}`,
                                      onConfirm: async () => { await LivingAppsService.deleteWartungEntry(w.record_id); loadAll(); }
                                    })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {[...wartungen].sort((a, b) => (b.fields.wartungsdatum ?? '').localeCompare(a.fields.wartungsdatum ?? '')).map(w => {
                        const overdue = isOverdue(w.fields.naechste_wartung);
                        return (
                          <div key={w.record_id}
                            className={`p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
                            onClick={() => { setEditWartung(w); setWartungDialog(true); }}>
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{resolveWerkzeugName(w.fields.werkzeug)}</div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={e => { e.stopPropagation(); setDeleteTarget({
                                  name: `Wartung ${resolveWerkzeugName(w.fields.werkzeug)}`,
                                  onConfirm: async () => { await LivingAppsService.deleteWartungEntry(w.record_id); loadAll(); }
                                }); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                {WARTUNGSTYP_LABELS[w.fields.wartungstyp ?? ''] ?? '-'}
                              </span>
                              <span>{formatDate(w.fields.wartungsdatum)}</span>
                            </div>
                            {w.fields.naechste_wartung && (
                              <div className={`text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                Nächste Wartung: {formatDate(w.fields.naechste_wartung)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: TEAM ═══ */}
          <TabsContent value="team">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Mitarbeiter ({mitarbeiter.length})</CardTitle>
                <Button size="sm" onClick={() => { setEditMitarbeiter(null); setMitarbeiterDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Neuer Mitarbeiter
                </Button>
              </CardHeader>
              <CardContent>
                {mitarbeiter.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Keine Mitarbeiter vorhanden.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Personalnr.</TableHead>
                            <TableHead>Abteilung</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>E-Mail</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...mitarbeiter].sort((a, b) => (a.fields.nachname ?? '').localeCompare(b.fields.nachname ?? '')).map(m => (
                            <TableRow key={m.record_id} className="group cursor-pointer"
                              onClick={() => { setEditMitarbeiter(m); setMitarbeiterDialog(true); }}>
                              <TableCell className="font-medium">{[m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ')}</TableCell>
                              <TableCell>{m.fields.personalnummer ?? '-'}</TableCell>
                              <TableCell>
                                {m.fields.abteilung && (
                                  <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                    {ABTEILUNG_LABELS[m.fields.abteilung] ?? m.fields.abteilung}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{m.fields.telefonnummer ?? '-'}</TableCell>
                              <TableCell>{m.fields.email ?? '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"
                                    onClick={() => { setEditMitarbeiter(m); setMitarbeiterDialog(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteTarget({
                                      name: [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' '),
                                      onConfirm: async () => { await LivingAppsService.deleteMitarbeiterEntry(m.record_id); loadAll(); }
                                    })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {[...mitarbeiter].sort((a, b) => (a.fields.nachname ?? '').localeCompare(b.fields.nachname ?? '')).map(m => (
                        <div key={m.record_id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => { setEditMitarbeiter(m); setMitarbeiterDialog(true); }}>
                          <div>
                            <div className="font-medium">{[m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ')}</div>
                            <div className="flex gap-2 mt-1">
                              {m.fields.abteilung && (
                                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                  {ABTEILUNG_LABELS[m.fields.abteilung]}
                                </span>
                              )}
                              {m.fields.personalnummer && (
                                <span className="text-xs text-muted-foreground">#{m.fields.personalnummer}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteTarget({
                                name: [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' '),
                                onConfirm: async () => { await LivingAppsService.deleteMitarbeiterEntry(m.record_id); loadAll(); }
                              })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: PROJEKTE ═══ */}
          <TabsContent value="projekte">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Projekte ({projekte.length})</CardTitle>
                <Button size="sm" onClick={() => { setEditProjekt(null); setProjektDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Neues Projekt
                </Button>
              </CardHeader>
              <CardContent>
                {projekte.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Keine Projekte vorhanden.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Projektname</TableHead>
                            <TableHead>Projektnr.</TableHead>
                            <TableHead>Kunde</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Ende</TableHead>
                            <TableHead>Projektleiter</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...projekte].sort((a, b) => (b.fields.startdatum ?? '').localeCompare(a.fields.startdatum ?? '')).map(p => (
                            <TableRow key={p.record_id} className="group cursor-pointer"
                              onClick={() => { setEditProjekt(p); setProjektDialog(true); }}>
                              <TableCell className="font-medium">{p.fields.projektname ?? '-'}</TableCell>
                              <TableCell>{p.fields.projektnummer ?? '-'}</TableCell>
                              <TableCell>{p.fields.kundenname ?? '-'}</TableCell>
                              <TableCell>{formatDate(p.fields.startdatum)}</TableCell>
                              <TableCell>{formatDate(p.fields.enddatum)}</TableCell>
                              <TableCell>{p.fields.projektleiter ?? '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"
                                    onClick={() => { setEditProjekt(p); setProjektDialog(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteTarget({
                                      name: p.fields.projektname ?? 'Projekt',
                                      onConfirm: async () => { await LivingAppsService.deleteProjekteEntry(p.record_id); loadAll(); }
                                    })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {[...projekte].sort((a, b) => (b.fields.startdatum ?? '').localeCompare(a.fields.startdatum ?? '')).map(p => (
                        <div key={p.record_id}
                          className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => { setEditProjekt(p); setProjektDialog(true); }}>
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{p.fields.projektname ?? '-'}</div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={e => { e.stopPropagation(); setDeleteTarget({
                                name: p.fields.projektname ?? 'Projekt',
                                onConfirm: async () => { await LivingAppsService.deleteProjekteEntry(p.record_id); loadAll(); }
                              }); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {p.fields.kundenname && <span>{p.fields.kundenname} &middot; </span>}
                            {formatDate(p.fields.startdatum)} - {formatDate(p.fields.enddatum)}
                          </div>
                          {p.fields.projektleiter && (
                            <div className="text-xs text-muted-foreground">Leiter: {p.fields.projektleiter}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: ZUWEISUNGEN ═══ */}
          <TabsContent value="zuweisungen">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Zuweisungen ({zuweisungen.length})</CardTitle>
                <Button size="sm" onClick={() => { setEditZuweisung(null); setZuweisungDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Werkzeug zuweisen
                </Button>
              </CardHeader>
              <CardContent>
                {zuweisungen.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Keine Zuweisungen vorhanden.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Werkzeug</TableHead>
                            <TableHead>Mitarbeiter</TableHead>
                            <TableHead>Projekt</TableHead>
                            <TableHead>Zugewiesen am</TableHead>
                            <TableHead>Geplante Rückgabe</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...zuweisungen].sort((a, b) => (b.fields.zuweisungsdatum ?? '').localeCompare(a.fields.zuweisungsdatum ?? '')).map(z => {
                            const isActive = !z.fields.tatsaechliche_rueckgabe;
                            const overdue = isActive && isOverdue(z.fields.geplante_rueckgabe);
                            return (
                              <TableRow key={z.record_id} className="group cursor-pointer"
                                onClick={() => { setEditZuweisung(z); setZuweisungDialog(true); }}>
                                <TableCell className="font-medium">{resolveWerkzeugName(z.fields.werkzeug)}</TableCell>
                                <TableCell>{resolveMitarbeiterName(z.fields.mitarbeiter)}</TableCell>
                                <TableCell>{z.fields.projekt ? resolveProjektName(z.fields.projekt) : '-'}</TableCell>
                                <TableCell>{formatDate(z.fields.zuweisungsdatum)}</TableCell>
                                <TableCell className={overdue ? 'text-red-600 font-medium' : ''}>
                                  {formatDate(z.fields.geplante_rueckgabe)}
                                </TableCell>
                                <TableCell>
                                  {isActive ? (
                                    <Badge variant="secondary" className={overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                                      {overdue ? 'Überfällig' : 'Aktiv'}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                      Zurückgegeben
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"
                                      onClick={() => { setEditZuweisung(z); setZuweisungDialog(true); }}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                      onClick={() => setDeleteTarget({
                                        name: `Zuweisung ${resolveWerkzeugName(z.fields.werkzeug)}`,
                                        onConfirm: async () => { await LivingAppsService.deleteWerkzeugzuweisungEntry(z.record_id); loadAll(); }
                                      })}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {[...zuweisungen].sort((a, b) => (b.fields.zuweisungsdatum ?? '').localeCompare(a.fields.zuweisungsdatum ?? '')).map(z => {
                        const isActive = !z.fields.tatsaechliche_rueckgabe;
                        const overdue = isActive && isOverdue(z.fields.geplante_rueckgabe);
                        return (
                          <div key={z.record_id}
                            className={`p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
                            onClick={() => { setEditZuweisung(z); setZuweisungDialog(true); }}>
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{resolveWerkzeugName(z.fields.werkzeug)}</div>
                              <Badge variant="secondary" className={
                                !isActive ? 'bg-emerald-100 text-emerald-700' :
                                overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }>
                                {!isActive ? 'Zurück' : overdue ? 'Überfällig' : 'Aktiv'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {resolveMitarbeiterName(z.fields.mitarbeiter)}
                              {z.fields.projekt && <span> &middot; {resolveProjektName(z.fields.projekt)}</span>}
                            </div>
                            <div className={`text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              Rückgabe: {formatDate(z.fields.geplante_rueckgabe)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── MOBILE FAB ─── */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden z-20">
        <Button className="w-full h-12 rounded-full text-base shadow-lg"
          onClick={() => { setEditZuweisung(null); setZuweisungDialog(true); }}>
          <ArrowLeftRight className="h-5 w-5 mr-2" />Werkzeug zuweisen
        </Button>
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Werkzeug Dialog */}
      <WerkzeugFormDialog open={werkzeugDialog} onOpenChange={setWerkzeugDialog}
        record={editWerkzeug} onSuccess={loadAll} />

      {/* Wartung Dialog */}
      <WartungFormDialog open={wartungDialog} onOpenChange={setWartungDialog}
        record={editWartung} werkzeuge={werkzeuge} onSuccess={loadAll} />

      {/* Mitarbeiter Dialog */}
      <MitarbeiterFormDialog open={mitarbeiterDialog} onOpenChange={setMitarbeiterDialog}
        record={editMitarbeiter} onSuccess={loadAll} />

      {/* Projekte Dialog */}
      <ProjektFormDialog open={projektDialog} onOpenChange={setProjektDialog}
        record={editProjekt} onSuccess={loadAll} />

      {/* Zuweisung Dialog */}
      <ZuweisungFormDialog open={zuweisungDialog} onOpenChange={setZuweisungDialog}
        record={editZuweisung} werkzeuge={werkzeuge} mitarbeiter={mitarbeiter} projekte={projekte}
        onSuccess={loadAll} />

      {/* Delete Confirmation */}
      <DeleteConfirm open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}
        name={deleteTarget?.name ?? ''} onConfirm={deleteTarget?.onConfirm ?? (async () => {})} />
    </div>
  );
}

// ═══════════════════════════════════════════
// FORM DIALOGS
// ═══════════════════════════════════════════

// ─── Werkzeug Form ───
function WerkzeugFormDialog({ open, onOpenChange, record, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: Werkzeuge | null; onSuccess: () => void;
}) {
  const isEdit = !!record;
  const [sub, setSub] = useState(false);
  const [form, setForm] = useState({
    werkzeugname: '', kategorie: '', hersteller: '', modellnummer: '', seriennummer: '',
    kaufdatum: '', kaufpreis: '', zustand: 'neu', lagerort: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        werkzeugname: record?.fields.werkzeugname ?? '',
        kategorie: record?.fields.kategorie ?? '',
        hersteller: record?.fields.hersteller ?? '',
        modellnummer: record?.fields.modellnummer ?? '',
        seriennummer: record?.fields.seriennummer ?? '',
        kaufdatum: record?.fields.kaufdatum?.split('T')[0] ?? todayStr(),
        kaufpreis: record?.fields.kaufpreis?.toString() ?? '',
        zustand: record?.fields.zustand ?? 'neu',
        lagerort: record?.fields.lagerort ?? '',
      });
    }
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSub(true);
    try {
      const data: Werkzeuge['fields'] = {
        werkzeugname: form.werkzeugname || undefined,
        kategorie: (form.kategorie || undefined) as Werkzeuge['fields']['kategorie'],
        hersteller: form.hersteller || undefined,
        modellnummer: form.modellnummer || undefined,
        seriennummer: form.seriennummer || undefined,
        kaufdatum: form.kaufdatum || undefined,
        kaufpreis: form.kaufpreis ? parseFloat(form.kaufpreis) : undefined,
        zustand: (form.zustand || undefined) as Werkzeuge['fields']['zustand'],
        lagerort: form.lagerort || undefined,
      };
      if (isEdit) {
        await LivingAppsService.updateWerkzeugeEntry(record!.record_id, data);
        toast.success('Werkzeug aktualisiert.');
      } else {
        await LivingAppsService.createWerkzeugeEntry(data);
        toast.success('Werkzeug erstellt.');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Werkzeug bearbeiten' : 'Neues Werkzeug'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wz-name">Werkzeugname *</Label>
            <Input id="wz-name" required value={form.werkzeugname}
              onChange={e => setForm(p => ({ ...p, werkzeugname: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={form.kategorie || 'none'} onValueChange={v => setForm(p => ({ ...p, kategorie: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {Object.entries(KATEGORIE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zustand</Label>
              <Select value={form.zustand || 'none'} onValueChange={v => setForm(p => ({ ...p, zustand: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {Object.entries(ZUSTAND_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wz-hersteller">Hersteller</Label>
              <Input id="wz-hersteller" value={form.hersteller}
                onChange={e => setForm(p => ({ ...p, hersteller: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-modell">Modellnummer</Label>
              <Input id="wz-modell" value={form.modellnummer}
                onChange={e => setForm(p => ({ ...p, modellnummer: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wz-serie">Seriennummer</Label>
              <Input id="wz-serie" value={form.seriennummer}
                onChange={e => setForm(p => ({ ...p, seriennummer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-lager">Lagerort</Label>
              <Input id="wz-lager" value={form.lagerort}
                onChange={e => setForm(p => ({ ...p, lagerort: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wz-kauf">Kaufdatum</Label>
              <Input id="wz-kauf" type="date" value={form.kaufdatum}
                onChange={e => setForm(p => ({ ...p, kaufdatum: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-preis">Kaufpreis (EUR)</Label>
              <Input id="wz-preis" type="number" step="0.01" value={form.kaufpreis}
                onChange={e => setForm(p => ({ ...p, kaufpreis: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={sub}>{sub ? 'Speichert...' : isEdit ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Wartung Form ───
function WartungFormDialog({ open, onOpenChange, record, werkzeuge, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: Wartung | null;
  werkzeuge: Werkzeuge[]; onSuccess: () => void;
}) {
  const isEdit = !!record;
  const [sub, setSub] = useState(false);
  const [form, setForm] = useState({
    werkzeug: '', wartungstyp: '', wartungsdatum: '', durchgefuehrt_von: '',
    kosten: '', naechste_wartung: '', notizen_wartung: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        werkzeug: extractRecordId(record?.fields.werkzeug) ?? '',
        wartungstyp: record?.fields.wartungstyp ?? '',
        wartungsdatum: record?.fields.wartungsdatum?.split('T')[0] ?? todayStr(),
        durchgefuehrt_von: record?.fields.durchgefuehrt_von ?? '',
        kosten: record?.fields.kosten?.toString() ?? '',
        naechste_wartung: record?.fields.naechste_wartung?.split('T')[0] ?? '',
        notizen_wartung: record?.fields.notizen_wartung ?? '',
      });
    }
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSub(true);
    try {
      const data: Wartung['fields'] = {
        werkzeug: form.werkzeug ? createRecordUrl(APP_IDS.WERKZEUGE, form.werkzeug) : undefined,
        wartungstyp: (form.wartungstyp || undefined) as Wartung['fields']['wartungstyp'],
        wartungsdatum: form.wartungsdatum || undefined,
        durchgefuehrt_von: form.durchgefuehrt_von || undefined,
        kosten: form.kosten ? parseFloat(form.kosten) : undefined,
        naechste_wartung: form.naechste_wartung || undefined,
        notizen_wartung: form.notizen_wartung || undefined,
      };
      if (isEdit) {
        await LivingAppsService.updateWartungEntry(record!.record_id, data);
        toast.success('Wartung aktualisiert.');
      } else {
        await LivingAppsService.createWartungEntry(data);
        toast.success('Wartung erstellt.');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Wartung bearbeiten' : 'Neue Wartung'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Werkzeug *</Label>
            <Select value={form.werkzeug || 'none'} onValueChange={v => setForm(p => ({ ...p, werkzeug: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Werkzeug auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Werkzeug</SelectItem>
                {werkzeuge.map(w => (
                  <SelectItem key={w.record_id} value={w.record_id}>{w.fields.werkzeugname ?? w.record_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Wartungstyp *</Label>
              <Select value={form.wartungstyp || 'none'} onValueChange={v => setForm(p => ({ ...p, wartungstyp: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Typ auswählen..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Typ</SelectItem>
                  {Object.entries(WARTUNGSTYP_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-datum">Wartungsdatum *</Label>
              <Input id="wa-datum" type="date" required value={form.wartungsdatum}
                onChange={e => setForm(p => ({ ...p, wartungsdatum: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wa-von">Durchgeführt von</Label>
              <Input id="wa-von" value={form.durchgefuehrt_von}
                onChange={e => setForm(p => ({ ...p, durchgefuehrt_von: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-kosten">Kosten (EUR)</Label>
              <Input id="wa-kosten" type="number" step="0.01" value={form.kosten}
                onChange={e => setForm(p => ({ ...p, kosten: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-next">Nächste Wartung fällig am</Label>
            <Input id="wa-next" type="date" value={form.naechste_wartung}
              onChange={e => setForm(p => ({ ...p, naechste_wartung: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-notes">Notizen</Label>
            <Textarea id="wa-notes" value={form.notizen_wartung}
              onChange={e => setForm(p => ({ ...p, notizen_wartung: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={sub}>{sub ? 'Speichert...' : isEdit ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mitarbeiter Form ───
function MitarbeiterFormDialog({ open, onOpenChange, record, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: Mitarbeiter | null; onSuccess: () => void;
}) {
  const isEdit = !!record;
  const [sub, setSub] = useState(false);
  const [form, setForm] = useState({
    vorname: '', nachname: '', personalnummer: '', abteilung: '', telefonnummer: '', email: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        vorname: record?.fields.vorname ?? '',
        nachname: record?.fields.nachname ?? '',
        personalnummer: record?.fields.personalnummer ?? '',
        abteilung: record?.fields.abteilung ?? '',
        telefonnummer: record?.fields.telefonnummer ?? '',
        email: record?.fields.email ?? '',
      });
    }
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSub(true);
    try {
      const data: Mitarbeiter['fields'] = {
        vorname: form.vorname || undefined,
        nachname: form.nachname || undefined,
        personalnummer: form.personalnummer || undefined,
        abteilung: (form.abteilung || undefined) as Mitarbeiter['fields']['abteilung'],
        telefonnummer: form.telefonnummer || undefined,
        email: form.email || undefined,
      };
      if (isEdit) {
        await LivingAppsService.updateMitarbeiterEntry(record!.record_id, data);
        toast.success('Mitarbeiter aktualisiert.');
      } else {
        await LivingAppsService.createMitarbeiterEntry(data);
        toast.success('Mitarbeiter erstellt.');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ma-vn">Vorname *</Label>
              <Input id="ma-vn" required value={form.vorname}
                onChange={e => setForm(p => ({ ...p, vorname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-nn">Nachname *</Label>
              <Input id="ma-nn" required value={form.nachname}
                onChange={e => setForm(p => ({ ...p, nachname: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ma-pn">Personalnummer</Label>
              <Input id="ma-pn" value={form.personalnummer}
                onChange={e => setForm(p => ({ ...p, personalnummer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Abteilung</Label>
              <Select value={form.abteilung || 'none'} onValueChange={v => setForm(p => ({ ...p, abteilung: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {Object.entries(ABTEILUNG_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ma-tel">Telefonnummer</Label>
              <Input id="ma-tel" type="tel" value={form.telefonnummer}
                onChange={e => setForm(p => ({ ...p, telefonnummer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-email">E-Mail</Label>
              <Input id="ma-email" type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={sub}>{sub ? 'Speichert...' : isEdit ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Projekt Form ───
function ProjektFormDialog({ open, onOpenChange, record, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: Projekte | null; onSuccess: () => void;
}) {
  const isEdit = !!record;
  const [sub, setSub] = useState(false);
  const [form, setForm] = useState({
    projektname: '', projektnummer: '', kundenname: '', strasse: '', hausnummer: '',
    postleitzahl: '', stadt: '', startdatum: '', enddatum: '', projektleiter: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        projektname: record?.fields.projektname ?? '',
        projektnummer: record?.fields.projektnummer ?? '',
        kundenname: record?.fields.kundenname ?? '',
        strasse: record?.fields.strasse ?? '',
        hausnummer: record?.fields.hausnummer ?? '',
        postleitzahl: record?.fields.postleitzahl ?? '',
        stadt: record?.fields.stadt ?? '',
        startdatum: record?.fields.startdatum?.split('T')[0] ?? todayStr(),
        enddatum: record?.fields.enddatum?.split('T')[0] ?? '',
        projektleiter: record?.fields.projektleiter ?? '',
      });
    }
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSub(true);
    try {
      const data: Projekte['fields'] = {
        projektname: form.projektname || undefined,
        projektnummer: form.projektnummer || undefined,
        kundenname: form.kundenname || undefined,
        strasse: form.strasse || undefined,
        hausnummer: form.hausnummer || undefined,
        postleitzahl: form.postleitzahl || undefined,
        stadt: form.stadt || undefined,
        startdatum: form.startdatum || undefined,
        enddatum: form.enddatum || undefined,
        projektleiter: form.projektleiter || undefined,
      };
      if (isEdit) {
        await LivingAppsService.updateProjekteEntry(record!.record_id, data);
        toast.success('Projekt aktualisiert.');
      } else {
        await LivingAppsService.createProjekteEntry(data);
        toast.success('Projekt erstellt.');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pj-name">Projektname *</Label>
              <Input id="pj-name" required value={form.projektname}
                onChange={e => setForm(p => ({ ...p, projektname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pj-nr">Projektnummer</Label>
              <Input id="pj-nr" value={form.projektnummer}
                onChange={e => setForm(p => ({ ...p, projektnummer: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pj-kunde">Kundenname</Label>
            <Input id="pj-kunde" value={form.kundenname}
              onChange={e => setForm(p => ({ ...p, kundenname: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="pj-str">Straße</Label>
              <Input id="pj-str" value={form.strasse}
                onChange={e => setForm(p => ({ ...p, strasse: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pj-hn">Hausnr.</Label>
              <Input id="pj-hn" value={form.hausnummer}
                onChange={e => setForm(p => ({ ...p, hausnummer: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pj-plz">PLZ</Label>
              <Input id="pj-plz" value={form.postleitzahl}
                onChange={e => setForm(p => ({ ...p, postleitzahl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pj-stadt">Stadt</Label>
              <Input id="pj-stadt" value={form.stadt}
                onChange={e => setForm(p => ({ ...p, stadt: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pj-start">Startdatum</Label>
              <Input id="pj-start" type="date" value={form.startdatum}
                onChange={e => setForm(p => ({ ...p, startdatum: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pj-end">Enddatum</Label>
              <Input id="pj-end" type="date" value={form.enddatum}
                onChange={e => setForm(p => ({ ...p, enddatum: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pj-leiter">Projektleiter</Label>
            <Input id="pj-leiter" value={form.projektleiter}
              onChange={e => setForm(p => ({ ...p, projektleiter: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={sub}>{sub ? 'Speichert...' : isEdit ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Zuweisung Form ───
function ZuweisungFormDialog({ open, onOpenChange, record, werkzeuge, mitarbeiter, projekte, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: Werkzeugzuweisung | null;
  werkzeuge: Werkzeuge[]; mitarbeiter: Mitarbeiter[]; projekte: Projekte[]; onSuccess: () => void;
}) {
  const isEdit = !!record;
  const isActive = isEdit && !record?.fields.tatsaechliche_rueckgabe;
  const [sub, setSub] = useState(false);
  const [form, setForm] = useState({
    werkzeug: '', mitarbeiter: '', projekt: '', zuweisungsdatum: '', geplante_rueckgabe: '', notizen: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        werkzeug: extractRecordId(record?.fields.werkzeug) ?? '',
        mitarbeiter: extractRecordId(record?.fields.mitarbeiter) ?? '',
        projekt: extractRecordId(record?.fields.projekt) ?? '',
        zuweisungsdatum: record?.fields.zuweisungsdatum?.split('T')[0] ?? todayStr(),
        geplante_rueckgabe: record?.fields.geplante_rueckgabe?.split('T')[0] ?? '',
        notizen: record?.fields.notizen ?? '',
      });
    }
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSub(true);
    try {
      const data: Werkzeugzuweisung['fields'] = {
        werkzeug: form.werkzeug ? createRecordUrl(APP_IDS.WERKZEUGE, form.werkzeug) : undefined,
        mitarbeiter: form.mitarbeiter ? createRecordUrl(APP_IDS.MITARBEITER, form.mitarbeiter) : undefined,
        projekt: form.projekt ? createRecordUrl(APP_IDS.PROJEKTE, form.projekt) : undefined,
        zuweisungsdatum: form.zuweisungsdatum || undefined,
        geplante_rueckgabe: form.geplante_rueckgabe || undefined,
        notizen: form.notizen || undefined,
      };
      if (isEdit) {
        await LivingAppsService.updateWerkzeugzuweisungEntry(record!.record_id, data);
        toast.success('Zuweisung aktualisiert.');
      } else {
        await LivingAppsService.createWerkzeugzuweisungEntry(data);
        toast.success('Werkzeug zugewiesen.');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  async function handleReturn() {
    if (!record) return;
    setSub(true);
    try {
      await LivingAppsService.updateWerkzeugzuweisungEntry(record.record_id, {
        tatsaechliche_rueckgabe: todayStr(),
      });
      toast.success('Rückgabe erfasst.');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally { setSub(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Zuweisung bearbeiten' : 'Werkzeug zuweisen'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Werkzeug *</Label>
            <Select value={form.werkzeug || 'none'} onValueChange={v => setForm(p => ({ ...p, werkzeug: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Werkzeug auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Werkzeug</SelectItem>
                {werkzeuge.map(w => (
                  <SelectItem key={w.record_id} value={w.record_id}>{w.fields.werkzeugname ?? w.record_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mitarbeiter *</Label>
            <Select value={form.mitarbeiter || 'none'} onValueChange={v => setForm(p => ({ ...p, mitarbeiter: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Mitarbeiter auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Mitarbeiter</SelectItem>
                {mitarbeiter.map(m => (
                  <SelectItem key={m.record_id} value={m.record_id}>
                    {[m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Projekt (optional)</Label>
            <Select value={form.projekt || 'none'} onValueChange={v => setForm(p => ({ ...p, projekt: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Projekt auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projekt</SelectItem>
                {projekte.map(p => (
                  <SelectItem key={p.record_id} value={p.record_id}>{p.fields.projektname ?? p.record_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="zw-datum">Zuweisungsdatum *</Label>
              <Input id="zw-datum" type="date" required value={form.zuweisungsdatum}
                onChange={e => setForm(p => ({ ...p, zuweisungsdatum: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zw-rueck">Geplante Rückgabe</Label>
              <Input id="zw-rueck" type="date" value={form.geplante_rueckgabe}
                onChange={e => setForm(p => ({ ...p, geplante_rueckgabe: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zw-notes">Notizen</Label>
            <Textarea id="zw-notes" value={form.notizen}
              onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))} />
          </div>
          {isEdit && record?.fields.tatsaechliche_rueckgabe && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              Zurückgegeben am: <strong>{formatDate(record.fields.tatsaechliche_rueckgabe)}</strong>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isActive && (
              <Button type="button" variant="outline" onClick={handleReturn} disabled={sub}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <RotateCcw className="h-4 w-4 mr-1" />Rückgabe erfassen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={sub}>{sub ? 'Speichert...' : isEdit ? 'Speichern' : 'Zuweisen'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
