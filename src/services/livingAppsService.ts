// AUTOMATICALLY GENERATED SERVICE
import { APP_IDS } from '@/types/app';
import type { Mitarbeiter, Werkzeuge, Wartung, Projekte, Werkzeugzuweisung } from '@/types/app';

// Base Configuration
const API_BASE_URL = 'https://my.living-apps.de/rest';

// --- HELPER FUNCTIONS ---
export function extractRecordId(url: string | null | undefined): string | null {
  if (!url) return null;
  // Extrahiere die letzten 24 Hex-Zeichen mit Regex
  const match = url.match(/([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

export function createRecordUrl(appId: string, recordId: string): string {
  return `https://my.living-apps.de/rest/apps/${appId}/records/${recordId}`;
}

async function callApi(method: string, endpoint: string, data?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Nutze Session Cookies für Auth
    body: data ? JSON.stringify(data) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  // DELETE returns often empty body or simple status
  if (method === 'DELETE') return true;
  return response.json();
}

export class LivingAppsService {
  // --- MITARBEITER ---
  static async getMitarbeiter(): Promise<Mitarbeiter[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getMitarbeiterEntry(id: string): Promise<Mitarbeiter | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createMitarbeiterEntry(fields: Mitarbeiter['fields']) {
    return callApi('POST', `/apps/${APP_IDS.MITARBEITER}/records`, { fields });
  }
  static async updateMitarbeiterEntry(id: string, fields: Partial<Mitarbeiter['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.MITARBEITER}/records/${id}`, { fields });
  }
  static async deleteMitarbeiterEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.MITARBEITER}/records/${id}`);
  }

  // --- WERKZEUGE ---
  static async getWerkzeuge(): Promise<Werkzeuge[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.WERKZEUGE}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getWerkzeugeEntry(id: string): Promise<Werkzeuge | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.WERKZEUGE}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createWerkzeugeEntry(fields: Werkzeuge['fields']) {
    return callApi('POST', `/apps/${APP_IDS.WERKZEUGE}/records`, { fields });
  }
  static async updateWerkzeugeEntry(id: string, fields: Partial<Werkzeuge['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.WERKZEUGE}/records/${id}`, { fields });
  }
  static async deleteWerkzeugeEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.WERKZEUGE}/records/${id}`);
  }

  // --- WARTUNG ---
  static async getWartung(): Promise<Wartung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.WARTUNG}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getWartungEntry(id: string): Promise<Wartung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.WARTUNG}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createWartungEntry(fields: Wartung['fields']) {
    return callApi('POST', `/apps/${APP_IDS.WARTUNG}/records`, { fields });
  }
  static async updateWartungEntry(id: string, fields: Partial<Wartung['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.WARTUNG}/records/${id}`, { fields });
  }
  static async deleteWartungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.WARTUNG}/records/${id}`);
  }

  // --- PROJEKTE ---
  static async getProjekte(): Promise<Projekte[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.PROJEKTE}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getProjekteEntry(id: string): Promise<Projekte | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.PROJEKTE}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createProjekteEntry(fields: Projekte['fields']) {
    return callApi('POST', `/apps/${APP_IDS.PROJEKTE}/records`, { fields });
  }
  static async updateProjekteEntry(id: string, fields: Partial<Projekte['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.PROJEKTE}/records/${id}`, { fields });
  }
  static async deleteProjekteEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.PROJEKTE}/records/${id}`);
  }

  // --- WERKZEUGZUWEISUNG ---
  static async getWerkzeugzuweisung(): Promise<Werkzeugzuweisung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.WERKZEUGZUWEISUNG}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getWerkzeugzuweisungEntry(id: string): Promise<Werkzeugzuweisung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.WERKZEUGZUWEISUNG}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createWerkzeugzuweisungEntry(fields: Werkzeugzuweisung['fields']) {
    return callApi('POST', `/apps/${APP_IDS.WERKZEUGZUWEISUNG}/records`, { fields });
  }
  static async updateWerkzeugzuweisungEntry(id: string, fields: Partial<Werkzeugzuweisung['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.WERKZEUGZUWEISUNG}/records/${id}`, { fields });
  }
  static async deleteWerkzeugzuweisungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.WERKZEUGZUWEISUNG}/records/${id}`);
  }

}