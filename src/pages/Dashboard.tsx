import { useState, useEffect } from 'react';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Werkzeuge, Mitarbeiter, Projekte, Werkzeugzuweisung, Wartung } from '@/types/app';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Wrench, Users, FolderKanban, ClipboardCheck, AlertTriangle, TrendingUp, Plus, Package, Activity } from 'lucide-react';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

// Lookup Data Labels (aus app_metadata.json)
const KATEGORIE_LABELS: Record<string, string> = {
  messgeraete: 'Messgeräte',
  pruefgeraete: 'Prüfgeräte',
  leitern_gerueste: 'Leitern und Gerüste',
  kabel_leitungen: 'Kabel und Leitungen',
  sonstiges: 'Sonstiges',
  elektrowerkzeuge: 'Elektrowerkzeuge',
  handwerkzeuge: 'Handwerkzeuge',
};

const ZUSTAND_LABELS: Record<string, string> = {
  neu: 'Neu',
  sehr_gut: 'Sehr gut',
  gut: 'Gut',
  befriedigend: 'Befriedigend',
  reparaturbeduerftig: 'Reparaturbedürftig',
  defekt: 'Defekt',
};

const WARTUNGSTYP_LABELS: Record<string, string> = {
  inspektion: 'Inspektion',
  reparatur: 'Reparatur',
  kalibrierung: 'Kalibrierung',
  reinigung: 'Reinigung',
  pruefung_dguv_v3: 'Prüfung nach DGUV V3',
  sonstiges: 'Sonstiges',
};

const ABTEILUNG_LABELS: Record<string, string> = {
  elektroinstallation: 'Elektroinstallation',
  wartung_service: 'Wartung und Service',
  planung: 'Planung',
  verwaltung: 'Verwaltung',
  lager: 'Lager',
};

export default function Dashboard() {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [werkzeuge, setWerkzeuge] = useState<Werkzeuge[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [projekte, setProjekte] = useState<Projekte[]>([]);
  const [zuweisungen, setZuweisungen] = useState<Werkzeugzuweisung[]>([]);
  const [wartungen, setWartungen] = useState<Wartung[]>([]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    werkzeug: '',
    mitarbeiter: '',
    projekt: '',
    zuweisungsdatum: format(new Date(), 'yyyy-MM-dd'),
    geplante_rueckgabe: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    notizen: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Load Data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [w, m, p, z, wa] = await Promise.all([
        LivingAppsService.getWerkzeuge(),
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getProjekte(),
        LivingAppsService.getWerkzeugzuweisung(),
        LivingAppsService.getWartung(),
      ]);
      setWerkzeuge(w);
      setMitarbeiter(m);
      setProjekte(p);
      setZuweisungen(z);
      setWartungen(wa);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }

  // Berechne KPIs
  const totalWerkzeuge = werkzeuge.length;
  const verfuegbareWerkzeuge = werkzeuge.filter((w) => {
    // Werkzeug ist verfügbar wenn es nicht zugewiesen ist oder zurückgegeben wurde
    const activeZuweisung = zuweisungen.find((z) => {
      const werkzeugId = extractRecordId(z.fields.werkzeug);
      return werkzeugId === w.record_id && !z.fields.tatsaechliche_rueckgabe;
    });
    return !activeZuweisung;
  }).length;

  const aktiveZuweisungen = zuweisungen.filter((z) => !z.fields.tatsaechliche_rueckgabe).length;

  // Überfällige Rückgaben
  const today = new Date();
  const ueberfaelligeRueckgaben = zuweisungen.filter((z) => {
    if (z.fields.tatsaechliche_rueckgabe) return false; // Bereits zurückgegeben
    if (!z.fields.geplante_rueckgabe) return false;
    return isBefore(new Date(z.fields.geplante_rueckgabe), today);
  }).length;

  // Fällige Wartungen (in den nächsten 30 Tagen)
  const faelligeWartungen = wartungen.filter((w) => {
    if (!w.fields.naechste_wartung) return false;
    const naechsteWartung = new Date(w.fields.naechste_wartung);
    return isBefore(naechsteWartung, addDays(today, 30));
  }).length;

  // Werkzeuge nach Zustand
  const werkzeugeNachZustand = werkzeuge.reduce((acc, w) => {
    const zustand = w.fields.zustand || 'unbekannt';
    acc[zustand] = (acc[zustand] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Problematische Werkzeuge (reparaturbedürftig oder defekt)
  const problematischeWerkzeuge = werkzeuge.filter((w) =>
    w.fields.zustand === 'reparaturbeduerftig' || w.fields.zustand === 'defekt'
  );

  // Werkzeuge nach Kategorie
  const werkzeugeNachKategorie = werkzeuge.reduce((acc, w) => {
    const kategorie = w.fields.kategorie || 'sonstiges';
    acc[kategorie] = (acc[kategorie] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Wartungskosten (letzte 30 Tage)
  const wartungskosten30Tage = wartungen
    .filter((w) => {
      if (!w.fields.wartungsdatum) return false;
      const wartungsDatum = new Date(w.fields.wartungsdatum);
      return isAfter(wartungsDatum, addDays(today, -30));
    })
    .reduce((sum, w) => sum + (w.fields.kosten || 0), 0);

  // Submit neue Zuweisung
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.werkzeug || !formData.mitarbeiter) {
      alert('Bitte Werkzeug und Mitarbeiter auswählen');
      return;
    }

    try {
      setSubmitting(true);
      await LivingAppsService.createWerkzeugzuweisungEntry({
        werkzeug: createRecordUrl(APP_IDS.WERKZEUGE, formData.werkzeug),
        mitarbeiter: createRecordUrl(APP_IDS.MITARBEITER, formData.mitarbeiter),
        projekt: formData.projekt ? createRecordUrl(APP_IDS.PROJEKTE, formData.projekt) : undefined,
        zuweisungsdatum: formData.zuweisungsdatum,
        geplante_rueckgabe: formData.geplante_rueckgabe,
        notizen: formData.notizen || undefined,
      });

      // Reset und reload
      setFormData({
        werkzeug: '',
        mitarbeiter: '',
        projekt: '',
        zuweisungsdatum: format(new Date(), 'yyyy-MM-dd'),
        geplante_rueckgabe: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        notizen: '',
      });
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Erstellen der Zuweisung');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-16 h-16 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Fehler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} className="w-full">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Werkzeugmanagement</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht über Werkzeuge, Zuweisungen und Wartungen
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Neue Zuweisung
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Werkzeug zuweisen</DialogTitle>
                <DialogDescription>
                  Weise ein Werkzeug einem Mitarbeiter zu
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="werkzeug">Werkzeug *</Label>
                  <Select
                    value={formData.werkzeug}
                    onValueChange={(value) => setFormData({ ...formData, werkzeug: value })}
                  >
                    <SelectTrigger id="werkzeug">
                      <SelectValue placeholder="Werkzeug auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {werkzeuge
                        .filter((w) => {
                          // Nur verfügbare Werkzeuge anzeigen
                          const activeZuweisung = zuweisungen.find((z) => {
                            const werkzeugId = extractRecordId(z.fields.werkzeug);
                            return werkzeugId === w.record_id && !z.fields.tatsaechliche_rueckgabe;
                          });
                          return !activeZuweisung && w.fields.zustand !== 'defekt';
                        })
                        .map((w) => (
                          <SelectItem key={w.record_id} value={w.record_id}>
                            {w.fields.werkzeugname || 'Unbenannt'}
                            {w.fields.kategorie && ` - ${KATEGORIE_LABELS[w.fields.kategorie]}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mitarbeiter">Mitarbeiter *</Label>
                  <Select
                    value={formData.mitarbeiter}
                    onValueChange={(value) => setFormData({ ...formData, mitarbeiter: value })}
                  >
                    <SelectTrigger id="mitarbeiter">
                      <SelectValue placeholder="Mitarbeiter auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {mitarbeiter.map((m) => (
                        <SelectItem key={m.record_id} value={m.record_id}>
                          {m.fields.vorname} {m.fields.nachname}
                          {m.fields.abteilung && ` - ${ABTEILUNG_LABELS[m.fields.abteilung]}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projekt">Projekt (optional)</Label>
                  <Select
                    value={formData.projekt}
                    onValueChange={(value) => setFormData({ ...formData, projekt: value })}
                  >
                    <SelectTrigger id="projekt">
                      <SelectValue placeholder="Projekt auswählen (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {projekte.map((p) => (
                        <SelectItem key={p.record_id} value={p.record_id}>
                          {p.fields.projektnummer || p.fields.projektname || 'Unbenannt'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zuweisungsdatum">Zuweisungsdatum</Label>
                  <Input
                    id="zuweisungsdatum"
                    type="date"
                    value={formData.zuweisungsdatum}
                    onChange={(e) => setFormData({ ...formData, zuweisungsdatum: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geplante_rueckgabe">Geplante Rückgabe</Label>
                  <Input
                    id="geplante_rueckgabe"
                    type="date"
                    value={formData.geplante_rueckgabe}
                    onChange={(e) => setFormData({ ...formData, geplante_rueckgabe: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notizen">Notizen</Label>
                  <Textarea
                    id="notizen"
                    placeholder="Optionale Notizen..."
                    value={formData.notizen}
                    onChange={(e) => setFormData({ ...formData, notizen: e.target.value })}
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Erstelle...' : 'Zuweisung erstellen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Werkzeuge gesamt</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWerkzeuge}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {verfuegbareWerkzeuge} verfügbar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aktive Zuweisungen</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aktiveZuweisungen}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {mitarbeiter.length} Mitarbeiter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Überfällige Rückgaben</CardTitle>
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{ueberfaelligeRueckgaben}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sofort kontaktieren
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fällige Wartungen</CardTitle>
              <ClipboardCheck className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{faelligeWartungen}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Nächste 30 Tage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Warnungen */}
        {(ueberfaelligeRueckgaben > 0 || problematischeWerkzeuge.length > 0) && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Sofortiger Handlungsbedarf
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ueberfaelligeRueckgaben > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {ueberfaelligeRueckgaben} überfällige Rückgabe{ueberfaelligeRueckgaben !== 1 ? 'n' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kontaktieren Sie die Mitarbeiter für eine sofortige Rückgabe
                    </p>
                  </div>
                </div>
              )}
              {problematischeWerkzeuge.length > 0 && (
                <div className="flex items-start gap-2">
                  <Wrench className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {problematischeWerkzeuge.length} Werkzeug{problematischeWerkzeuge.length !== 1 ? 'e' : ''} reparaturbedürftig/defekt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {problematischeWerkzeuge.slice(0, 3).map(w => w.fields.werkzeugname).join(', ')}
                      {problematischeWerkzeuge.length > 3 && ` und ${problematischeWerkzeuge.length - 3} weitere`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Werkzeuge nach Zustand */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Werkzeugzustand
              </CardTitle>
              <CardDescription>Verteilung nach Zustand</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(werkzeugeNachZustand)
                  .sort((a, b) => b[1] - a[1])
                  .map(([zustand, count]) => {
                    const percentage = (count / totalWerkzeuge) * 100;
                    const isProblematic = zustand === 'reparaturbeduerftig' || zustand === 'defekt';
                    return (
                      <div key={zustand} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {ZUSTAND_LABELS[zustand] || zustand}
                          </span>
                          <span className={isProblematic ? 'text-destructive font-bold' : ''}>
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isProblematic ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Werkzeuge nach Kategorie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5" />
                Kategorien
              </CardTitle>
              <CardDescription>Werkzeuge nach Typ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(werkzeugeNachKategorie)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kategorie, count]) => {
                    const percentage = (count / totalWerkzeuge) * 100;
                    return (
                      <div key={kategorie} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {KATEGORIE_LABELS[kategorie] || kategorie}
                          </span>
                          <span>
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wartungsübersicht */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Wartungen
            </CardTitle>
            <CardDescription>Anstehende Wartungen und Kosten</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gesamt Wartungen</p>
                <p className="text-2xl font-bold">{wartungen.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fällig (30 Tage)</p>
                <p className="text-2xl font-bold text-warning">{faelligeWartungen}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Kosten (30 Tage)</p>
                <p className="text-2xl font-bold">
                  {wartungskosten30Tage.toFixed(2)} €
                </p>
              </div>
            </div>

            {/* Anstehende Wartungen Liste */}
            {faelligeWartungen > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Anstehende Wartungen</h4>
                <div className="space-y-2">
                  {wartungen
                    .filter((w) => {
                      if (!w.fields.naechste_wartung) return false;
                      const naechsteWartung = new Date(w.fields.naechste_wartung);
                      return isBefore(naechsteWartung, addDays(today, 30));
                    })
                    .sort((a, b) => {
                      const dateA = new Date(a.fields.naechste_wartung!);
                      const dateB = new Date(b.fields.naechste_wartung!);
                      return dateA.getTime() - dateB.getTime();
                    })
                    .slice(0, 5)
                    .map((w) => {
                      const werkzeugId = extractRecordId(w.fields.werkzeug);
                      const werkzeug = werkzeugId ? werkzeuge.find(wz => wz.record_id === werkzeugId) : null;
                      const naechsteWartung = new Date(w.fields.naechste_wartung!);
                      const tageVerbleibend = differenceInDays(naechsteWartung, today);
                      const isUeberfaellig = tageVerbleibend < 0;

                      return (
                        <div
                          key={w.record_id}
                          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {werkzeug?.fields.werkzeugname || 'Unbekanntes Werkzeug'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {WARTUNGSTYP_LABELS[w.fields.wartungstyp || 'sonstiges']}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={isUeberfaellig ? 'destructive' : 'secondary'}>
                              {isUeberfaellig
                                ? `${Math.abs(tageVerbleibend)} Tage überfällig`
                                : `in ${tageVerbleibend} Tagen`
                              }
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(naechsteWartung, 'dd.MM.yyyy', { locale: de })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aktuelle Zuweisungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Aktuelle Zuweisungen
            </CardTitle>
            <CardDescription>Werkzeuge im Einsatz</CardDescription>
          </CardHeader>
          <CardContent>
            {aktiveZuweisungen === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Keine aktiven Zuweisungen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {zuweisungen
                  .filter((z) => !z.fields.tatsaechliche_rueckgabe)
                  .sort((a, b) => {
                    // Überfällige zuerst
                    const aUeberfaellig = a.fields.geplante_rueckgabe && isBefore(new Date(a.fields.geplante_rueckgabe), today);
                    const bUeberfaellig = b.fields.geplante_rueckgabe && isBefore(new Date(b.fields.geplante_rueckgabe), today);
                    if (aUeberfaellig && !bUeberfaellig) return -1;
                    if (!aUeberfaellig && bUeberfaellig) return 1;
                    return 0;
                  })
                  .slice(0, 8)
                  .map((z) => {
                    const werkzeugId = extractRecordId(z.fields.werkzeug);
                    const mitarbeiterId = extractRecordId(z.fields.mitarbeiter);
                    const projektId = extractRecordId(z.fields.projekt);

                    const werkzeug = werkzeugId ? werkzeuge.find(w => w.record_id === werkzeugId) : null;
                    const mitarbeiterObj = mitarbeiterId ? mitarbeiter.find(m => m.record_id === mitarbeiterId) : null;
                    const projekt = projektId ? projekte.find(p => p.record_id === projektId) : null;

                    const isUeberfaellig = z.fields.geplante_rueckgabe &&
                      isBefore(new Date(z.fields.geplante_rueckgabe), today);

                    return (
                      <div
                        key={z.record_id}
                        className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border ${
                          isUeberfaellig ? 'border-destructive bg-destructive/5' : 'bg-secondary/50'
                        }`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {werkzeug?.fields.werkzeugname || 'Unbekanntes Werkzeug'}
                            </p>
                            {isUeberfaellig && (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {mitarbeiterObj
                              ? `${mitarbeiterObj.fields.vorname} ${mitarbeiterObj.fields.nachname}`
                              : 'Unbekannter Mitarbeiter'
                            }
                            {projekt && ` • ${projekt.fields.projektname || projekt.fields.projektnummer}`}
                          </p>
                        </div>
                        <div className="text-right mt-2 md:mt-0">
                          {z.fields.geplante_rueckgabe && (
                            <Badge variant={isUeberfaellig ? 'destructive' : 'secondary'}>
                              Rückgabe: {format(new Date(z.fields.geplante_rueckgabe), 'dd.MM.yyyy', { locale: de })}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {aktiveZuweisungen > 8 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... und {aktiveZuweisungen - 8} weitere
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
