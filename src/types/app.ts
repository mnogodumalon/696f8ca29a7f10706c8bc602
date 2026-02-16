// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export interface Mitarbeiter {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    personalnummer?: string;
    abteilung?: 'wartung_service' | 'planung' | 'elektroinstallation' | 'verwaltung' | 'lager';
    telefonnummer?: string;
    email?: string;
  };
}

export interface Werkzeuge {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    werkzeugname?: string;
    kategorie?: 'handwerkzeuge' | 'messgeraete' | 'pruefgeraete' | 'leitern_gerueste' | 'kabel_leitungen' | 'sonstiges' | 'elektrowerkzeuge';
    hersteller?: string;
    modellnummer?: string;
    seriennummer?: string;
    kaufdatum?: string; // Format: YYYY-MM-DD oder ISO String
    kaufpreis?: number;
    zustand?: 'neu' | 'sehr_gut' | 'gut' | 'befriedigend' | 'reparaturbeduerftig' | 'defekt';
    lagerort?: string;
  };
}

export interface Wartung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    werkzeug?: string; // applookup -> URL zu 'Werkzeuge' Record
    wartungstyp?: 'inspektion' | 'reparatur' | 'kalibrierung' | 'reinigung' | 'pruefung_dguv_v3' | 'sonstiges';
    wartungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    durchgefuehrt_von?: string;
    kosten?: number;
    naechste_wartung?: string; // Format: YYYY-MM-DD oder ISO String
    notizen_wartung?: string;
  };
}

export interface Projekte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    projektname?: string;
    projektnummer?: string;
    kundenname?: string;
    strasse?: string;
    hausnummer?: string;
    postleitzahl?: string;
    stadt?: string;
    startdatum?: string; // Format: YYYY-MM-DD oder ISO String
    enddatum?: string; // Format: YYYY-MM-DD oder ISO String
    projektleiter?: string;
  };
}

export interface Werkzeugzuweisung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    werkzeug?: string; // applookup -> URL zu 'Werkzeuge' Record
    mitarbeiter?: string; // applookup -> URL zu 'Mitarbeiter' Record
    projekt?: string; // applookup -> URL zu 'Projekte' Record
    zuweisungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geplante_rueckgabe?: string; // Format: YYYY-MM-DD oder ISO String
    tatsaechliche_rueckgabe?: string; // Format: YYYY-MM-DD oder ISO String
    notizen?: string;
  };
}

export const APP_IDS = {
  MITARBEITER: '696f8c7b968ea65b5fb99bc6',
  WERKZEUGE: '696f8c7334d65b459b907abf',
  WARTUNG: '696f8c7ee5875b7ce993a752',
  PROJEKTE: '696f8c7cbb8d1cc8e4f308cb',
  WERKZEUGZUWEISUNG: '696f8c7d4b3dfccc760e252e',
} as const;

// Helper Types for creating new records
export type CreateMitarbeiter = Mitarbeiter['fields'];
export type CreateWerkzeuge = Werkzeuge['fields'];
export type CreateWartung = Wartung['fields'];
export type CreateProjekte = Projekte['fields'];
export type CreateWerkzeugzuweisung = Werkzeugzuweisung['fields'];