import asyncio
import json
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, ToolUseBlock, TextBlock, ResultMessage, create_sdk_mcp_server, tool
import subprocess
import os

async def main():
    # Skills and CLAUDE.md are loaded automatically by Claude SDK from cwd
    # No manual instruction loading needed - the SDK reads:
    # - /home/user/app/CLAUDE.md (copied from SANDBOX_PROMPT.md)
    # - /home/user/app/.claude/skills/ (copied from sandbox_skills/)

    def run_git_cmd(cmd: str):
        """Executes a Git command and throws an error on failure"""
        print(f"[DEPLOY] Executing: {cmd}")
        result = subprocess.run(
            cmd,
            shell=True,
            cwd="/home/user/app",
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise Exception(f"Git Error ({cmd}): {result.stderr}")
        return result.stdout

    @tool("deploy_to_github",
    "Initializes Git, commits EVERYTHING, and pushes it to the configured repository. Use this ONLY at the very end.",
    {})
    async def deploy_to_github(args):
        try:
            run_git_cmd("git config --global user.email 'lilo@livinglogic.de'")
            run_git_cmd("git config --global user.name 'Lilo'")
            
            git_push_url = os.getenv('GIT_PUSH_URL')
            appgroup_id = os.getenv('REPO_NAME')
            livingapps_api_key = os.getenv('LIVINGAPPS_API_KEY')
            
            # Prüfe ob Repo existiert und übernehme .git History
            print("[DEPLOY] Prüfe ob Repo bereits existiert...")
            try:
                run_git_cmd(f"git clone {git_push_url} /tmp/old_repo")
                run_git_cmd("cp -r /tmp/old_repo/.git /home/user/app/.git")
                print("[DEPLOY] ✅ History vom existierenden Repo übernommen")
            except:
                # Neues Repo - von vorne initialisieren
                print("[DEPLOY] ✅ Neues Repo wird initialisiert")
                run_git_cmd("git init")
                run_git_cmd("git checkout -b main")
                run_git_cmd(f"git remote add origin {git_push_url}")
            
            # Mit HOME=/home/user/app schreibt das SDK direkt nach /home/user/app/.claude/
            # Kein Kopieren nötig! .claude ist bereits im Repo-Ordner.
            print("[DEPLOY] 💾 Session wird mit Code gepusht (HOME=/home/user/app)")
            
            # Session ID wird später von ResultMessage gespeichert
            # Hier nur prüfen ob .claude existiert
            check_result = subprocess.run(
                "ls /home/user/app/.claude 2>&1",
                shell=True,
                capture_output=True,
                text=True
            )
            if check_result.returncode == 0:
                print("[DEPLOY] ✅ .claude/ vorhanden - wird mit gepusht")
            else:
                print("[DEPLOY] ⚠️ .claude/ nicht gefunden")
            
            # Neuen Code committen (includes .claude/ direkt im Repo)
            run_git_cmd("git add -A")
            # Force add .claude (exclude debug/ - may contain secrets)
            subprocess.run("git add -f .claude ':!.claude/debug' .claude_session_id 2>/dev/null", shell=True, cwd="/home/user/app")
            run_git_cmd("git commit -m 'Lilo Auto-Deploy' --allow-empty")
            run_git_cmd("git push origin main")
            
            print("[DEPLOY] ✅ Push erfolgreich!")
            
            # Ab hier: Warte auf Dashboard und aktiviere Links
            if livingapps_api_key and appgroup_id:
                import httpx
                import time
                
                headers = {
                    "X-API-Key": livingapps_api_key,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
                
                try:
                    # 1. Hole alle App-IDs der Appgroup
                    print(f"[DEPLOY] Lade Appgroup: {appgroup_id}")
                    resp = httpx.get(
                        f"https://my.living-apps.de/rest/appgroups/{appgroup_id}",
                        headers=headers,
                        timeout=30
                    )
                    resp.raise_for_status()
                    appgroup = resp.json()
                    
                    app_ids = [app_data["id"] for app_data in appgroup.get("apps", {}).values()]
                    print(f"[DEPLOY] Gefunden: {len(app_ids)} Apps")
                    
                    if not app_ids:
                        print("[DEPLOY] ⚠️ Keine Apps gefunden")
                        return {"content": [{"type": "text", "text": "✅ Deployment erfolgreich!"}]}
                    
                    dashboard_url = f"https://my.living-apps.de/github/{appgroup_id}/"
                    
                    # 2. Warte bis Dashboard verfügbar ist
                    print(f"[DEPLOY] ⏳ Warte auf Dashboard: {dashboard_url}")
                    max_attempts = 180  # Max 180 Sekunden warten
                    for attempt in range(max_attempts):
                        try:
                            check_resp = httpx.get(dashboard_url, timeout=5)
                            if check_resp.status_code == 200:
                                print(f"[DEPLOY] ✅ Dashboard ist verfügbar!")
                                break
                        except:
                            pass
                        
                        if attempt < max_attempts - 1:
                            time.sleep(1)
                        else:
                            print("[DEPLOY] ⚠️ Timeout - Dashboard nicht erreichbar")
                            return {"content": [{"type": "text", "text": "✅ Deployment erfolgreich! Dashboard-Links konnten nicht aktiviert werden."}]}
                    
                    # 3. Aktiviere Dashboard-Links
                    print("[DEPLOY] 🎉 Aktiviere Dashboard-Links...")
                    for app_id in app_ids:
                        try:
                            # URL aktivieren
                            httpx.put(
                                f"https://my.living-apps.de/rest/apps/{app_id}/params/la_page_header_additional_url",
                                headers=headers,
                                json={"description": "dashboard_url", "type": "string", "value": dashboard_url},
                                timeout=10
                            )
                            # Title aktualisieren
                            httpx.put(
                                f"https://my.living-apps.de/rest/apps/{app_id}/params/la_page_header_additional_title",
                                headers=headers,
                                json={"description": "dashboard_title", "type": "string", "value": "Dashboard"},
                                timeout=10
                            )
                            print(f"[DEPLOY]   ✓ App {app_id} aktiviert")
                        except Exception as e:
                            print(f"[DEPLOY]   ✗ App {app_id}: {e}")
                    
                    print("[DEPLOY] ✅ Dashboard-Links erfolgreich hinzugefügt!")
                    
                except Exception as e:
                    print(f"[DEPLOY] ⚠️ Fehler beim Hinzufügen der Dashboard-Links: {e}")

            return {
                "content": [{"type": "text", "text": "✅ Deployment erfolgreich! Code wurde gepusht und Dashboard-Links hinzugefügt."}]
            }

        except Exception as e:
            return {"content": [{"type": "text", "text": f"Deployment Failed: {str(e)}"}], "is_error": True}

    deployment_server = create_sdk_mcp_server(
        name="deployment",
        version="1.0.0",
        tools=[deploy_to_github]
    )

    # 3. Optionen konfigurieren
    # setting_sources=["project"] is REQUIRED to load CLAUDE.md and .claude/skills/ from cwd
    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code"
        },
        setting_sources=["project"],  # Required: loads CLAUDE.md and .claude/skills/
        mcp_servers={"deploy_tools": deployment_server},
        permission_mode="acceptEdits",
        allowed_tools=["Bash", "Write", "Read", "Edit", "Glob", "Grep", "Task", "TodoWrite",
        "mcp__deploy_tools__deploy_to_github"
        ],
        cwd="/home/user/app",
        model="claude-opus-4-6", #"claude-sonnet-4-5-20250929"
    )

    # Session-Resume Unterstützung
    resume_session_id = os.getenv('RESUME_SESSION_ID')
    if resume_session_id:
        options.resume = resume_session_id
        print(f"[LILO] Resuming session: {resume_session_id}")

    # User Prompt - prefer file over env var (handles special chars better)
    user_prompt = None
    
    # First try reading from file (more reliable for special chars like umlauts)
    prompt_file = "/home/user/app/.user_prompt"
    if os.path.exists(prompt_file):
        try:
            with open(prompt_file, 'r') as f:
                user_prompt = f.read().strip()
            if user_prompt:
                print(f"[LILO] Prompt aus Datei gelesen: {len(user_prompt)} Zeichen")
        except Exception as e:
            print(f"[LILO] Fehler beim Lesen der Prompt-Datei: {e}")
    
    # Fallback to env var (for backwards compatibility)
    if not user_prompt:
        user_prompt = os.getenv('USER_PROMPT')
        if user_prompt:
            print(f"[LILO] Prompt aus ENV gelesen")
    
    if user_prompt:
        # Continue/Resume-Mode: Custom prompt vom User
        query = f"""🚨 AUFGABE: Du MUSST das existierende Dashboard ändern und deployen!

User-Anfrage: "{user_prompt}"

PFLICHT-SCHRITTE (alle müssen ausgeführt werden):

1. LESEN: Lies src/pages/Dashboard.tsx um die aktuelle Struktur zu verstehen
2. ÄNDERN: Implementiere die User-Anfrage mit dem Edit-Tool
3. TESTEN: Führe 'npm run build' aus um sicherzustellen dass es kompiliert
4. DEPLOYEN: Rufe deploy_to_github auf um die Änderungen zu pushen

⚠️ KRITISCH:
- Du MUSST Änderungen am Code machen (Edit-Tool verwenden!)
- Du MUSST am Ende deploy_to_github aufrufen!
- Beende NICHT ohne zu deployen!
- Analysieren alleine reicht NICHT - du musst HANDELN!

Das Dashboard existiert bereits. Mache NUR die angeforderten Änderungen, nicht mehr.
Starte JETZT mit Schritt 1!"""
        print(f"[LILO] Continue-Mode mit User-Prompt: {user_prompt}")
    else:
        # Normal-Mode: Neues Dashboard bauen
        query = (
            "Use frontend-design Skill to create analyse app structure and generate design_brief.md"
            "Build the Dashboard.tsx following design_brief.md exactly. "
            "Use existing types and services from src/types/ and src/services/. "
            "Deploy when done using the deploy_to_github tool."
        )
        print(f"[LILO] Build-Mode: Neues Dashboard erstellen")

    print(f"[LILO] Initialisiere Client")

    # 4. Der Client Lifecycle
    async with ClaudeSDKClient(options=options) as client:

        # Anfrage senden
        await client.query(query)

        # 5. Antwort-Schleife
        # receive_response() liefert alles bis zum Ende des Auftrags
        async for message in client.receive_response():
            
            # A. Wenn er denkt oder spricht
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        #als JSON-Zeile ausgeben
                        print(json.dumps({"type": "think", "content": block.text}), flush=True)
                    
                    elif isinstance(block, ToolUseBlock):
                        print(json.dumps({"type": "tool", "tool": block.name, "input": str(block.input)}), flush=True)

            # B. Wenn er fertig ist (oder Fehler)
            elif isinstance(message, ResultMessage):
                status = "success" if not message.is_error else "error"
                print(f"[LILO] Session ID: {message.session_id}")
                
                # Save session_id to file for future resume (AFTER ResultMessage)
                if message.session_id:
                    try:
                        with open("/home/user/app/.claude_session_id", "w") as f:
                            f.write(message.session_id)
                        print(f"[LILO] ✅ Session ID in Datei gespeichert")
                    except Exception as e:
                        print(f"[LILO] ⚠️ Fehler beim Speichern der Session ID: {e}")
                
                print(json.dumps({
                    "type": "result", 
                    "status": status, 
                    "cost": message.total_cost_usd,
                    "session_id": message.session_id
                }), flush=True)

if __name__ == "__main__":
    asyncio.run(main())