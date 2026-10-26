//! Module Steam de Dot Companion : lit les fichiers locaux de Steam pour Dot Steam.
//!
//! - emplacement de Steam, Steam ouvert, jeu en cours : registre Windows
//!   (`HKCU\Software\Valve\Steam` : `SteamPath`, `RunningAppID`, `ActiveProcess\pid`) ;
//! - bibliothèques : `steamapps/libraryfolders.vdf` ; jeux installés et téléchargements :
//!   un `appmanifest_<id>.acf` par jeu ;
//! - dernier lancement et temps de jeu : `userdata/<id>/config/localconfig.vdf` ;
//!   compte connecté : `config/loginusers.vdf` ;
//! - jaquettes : cache de Steam (`appcache/librarycache`), sinon les images publiques du magasin,
//!   téléchargées une fois avec `curl` et gardées dans `%APPDATA%\Xeneon\cache\steam` ;
//! - amis : API Web Steam (clé d'API de l'instance), en arrière-plan, toutes les 60 s au plus ;
//! - profil : pseudo (`loginusers.vdf`), avatar (`config/avatarcache`), statut (API, sinon `localconfig.vdf`) ;
//!   changer de statut et ouvrir une page de Steam : `steam://friends/status/<statut>`, `steam://open/<page>`.
//!
//! Pour les essais hors Windows : `DOT_STEAM_PATH` (dossier de Steam) et `DOT_STEAM_REGISTRY`
//! (fichier `registry.vdf`, comme celui de Steam sous Linux).

use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ---------------------------------------------------------------- VDF (KeyValues texte de Valve)

/// Lit un fichier VDF en objet JSON (valeurs en chaînes, sous-blocs en objets).
pub fn parse_vdf(text: &str) -> Value {
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    Value::Object(parse_block(&chars, &mut i))
}

fn token(c: &[char], i: &mut usize) -> Option<String> {
    loop {
        while *i < c.len() && c[*i].is_whitespace() {
            *i += 1;
        }
        if *i + 1 < c.len() && c[*i] == '/' && c[*i + 1] == '/' {
            while *i < c.len() && c[*i] != '\n' {
                *i += 1;
            }
            continue;
        }
        if *i < c.len() && c[*i] == '[' {
            // condition de plateforme ([$WIN32]…) : ignorée
            while *i < c.len() && c[*i] != ']' {
                *i += 1;
            }
            *i += 1;
            continue;
        }
        break;
    }
    if *i >= c.len() {
        return None;
    }
    match c[*i] {
        '{' | '}' => {
            *i += 1;
            Some(c[*i - 1].to_string())
        }
        '"' => {
            *i += 1;
            let mut s = String::new();
            while *i < c.len() && c[*i] != '"' {
                if c[*i] == '\\' && *i + 1 < c.len() {
                    *i += 1;
                    s.push(match c[*i] {
                        'n' => '\n',
                        't' => '\t',
                        other => other,
                    });
                } else {
                    s.push(c[*i]);
                }
                *i += 1;
            }
            *i += 1;
            Some(format!("\u{0}{s}")) // marque « chaîne » pour ne pas confondre "{" et {
        }
        _ => {
            let mut s = String::new();
            while *i < c.len() && !c[*i].is_whitespace() && c[*i] != '{' && c[*i] != '}' && c[*i] != '"' {
                s.push(c[*i]);
                *i += 1;
            }
            Some(format!("\u{0}{s}"))
        }
    }
}

fn parse_block(c: &[char], i: &mut usize) -> Map<String, Value> {
    let mut m = Map::new();
    while let Some(t) = token(c, i) {
        if t == "}" {
            break;
        }
        if t == "{" {
            continue;
        }
        let key = t.trim_start_matches('\u{0}').to_string();
        match token(c, i) {
            Some(v) if v == "{" => {
                let b = parse_block(c, i);
                m.entry(key).or_insert(Value::Object(b));
            }
            Some(v) if v == "}" => break,
            Some(v) => {
                m.entry(key).or_insert(Value::String(v.trim_start_matches('\u{0}').to_string()));
            }
            None => break,
        }
    }
    m
}

/// Clé sans tenir compte de la casse (Steam écrit « apps » ou « Apps » selon les fichiers).
fn get<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    v.as_object()?.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v)
}
fn path<'a>(v: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().try_fold(v, |cur, k| get(cur, k))
}
fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    get(v, key).and_then(Value::as_str).unwrap_or("")
}
fn n(v: &Value, key: &str) -> u64 {
    s(v, key).trim().parse().unwrap_or(0)
}
fn read_vdf(p: &Path) -> Option<Value> {
    fs::read_to_string(p).ok().map(|t| parse_vdf(&t))
}

// ---------------------------------------------------------------- registre

#[cfg(windows)]
fn reg_query(key: &str, value: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = std::process::Command::new("reg")
        .args(["query", key, "/v", value])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0].eq_ignore_ascii_case(value) && parts[1].starts_with("REG_") {
            let raw = parts[2..].join(" ");
            if parts[1] == "REG_DWORD" {
                return u64::from_str_radix(raw.trim_start_matches("0x"), 16).ok().map(|x| x.to_string());
            }
            return Some(raw);
        }
    }
    None
}

/// Valeurs du registre de Steam : chemin, jeu en cours, processus de Steam.
struct Registry {
    steam_path: Option<String>,
    running_app: u64,
    pid: u64,
}

fn registry() -> Registry {
    if let Ok(f) = std::env::var("DOT_STEAM_REGISTRY") {
        let v = read_vdf(Path::new(&f)).unwrap_or(Value::Null);
        let st = path(&v, &["Registry", "HKCU", "Software", "Valve", "Steam"]).cloned().unwrap_or(Value::Null);
        return Registry {
            steam_path: get(&st, "SteamPath").and_then(Value::as_str).map(str::to_string),
            running_app: n(&st, "RunningAppID"),
            pid: get(&st, "ActiveProcess").map(|a| n(a, "pid")).unwrap_or(0),
        };
    }
    #[cfg(windows)]
    {
        Registry {
            steam_path: reg_query("HKCU\\Software\\Valve\\Steam", "SteamPath"),
            running_app: reg_query("HKCU\\Software\\Valve\\Steam", "RunningAppID").and_then(|x| x.parse().ok()).unwrap_or(0),
            pid: reg_query("HKCU\\Software\\Valve\\Steam\\ActiveProcess", "pid").and_then(|x| x.parse().ok()).unwrap_or(0),
        }
    }
    #[cfg(not(windows))]
    {
        Registry { steam_path: None, running_app: 0, pid: 0 }
    }
}

fn steam_root(reg: &Registry) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("DOT_STEAM_PATH") {
        return Some(PathBuf::from(p));
    }
    let mut cands: Vec<PathBuf> = Vec::new();
    if let Some(p) = &reg.steam_path {
        cands.push(PathBuf::from(p));
    }
    cands.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));
    if let Ok(h) = std::env::var("HOME") {
        cands.push(PathBuf::from(&h).join(".steam/steam"));
        cands.push(PathBuf::from(&h).join(".local/share/Steam"));
    }
    cands.into_iter().find(|p| p.join("steamapps").is_dir())
}

// ---------------------------------------------------------------- jeux

#[derive(Clone)]
struct App {
    appid: u64,
    name: String,
    flags: u64,
    to_download: u64,
    downloaded: u64,
    to_stage: u64,
    staged: u64,
    lib: PathBuf,
}

// StateFlags (EAppState) de Steam
const UPDATE_REQUIRED: u64 = 2;
const UPDATE_RUNNING: u64 = 256;
const UPDATE_PAUSED: u64 = 512;
const UPDATE_STARTED: u64 = 1024;
const DOWNLOADING: u64 = 1_048_576;
const STAGING: u64 = 2_097_152;

/// Outils et composants que Steam installe comme des « jeux » : jamais montrés.
fn is_tool(name: &str, appid: u64) -> bool {
    let l = name.to_lowercase();
    appid == 228980
        || l.starts_with("steamworks common")
        || l.starts_with("proton")
        || l.starts_with("steam linux runtime")
        || l.contains("redistributable")
        || l.starts_with("steamvr")
}

fn libraries(root: &Path) -> Vec<PathBuf> {
    let mut libs = vec![root.to_path_buf()];
    if let Some(v) = read_vdf(&root.join("steamapps/libraryfolders.vdf")) {
        if let Some(Value::Object(m)) = get(&v, "libraryfolders") {
            for (k, e) in m {
                if !k.chars().all(|c| c.is_ascii_digit()) {
                    continue;
                }
                let p = match e {
                    Value::String(p) => p.clone(), // ancien format : "1" "D:\\SteamLibrary"
                    _ => s(e, "path").to_string(),
                };
                if !p.is_empty() {
                    let pb = PathBuf::from(p);
                    if !libs.iter().any(|l| l == &pb) {
                        libs.push(pb);
                    }
                }
            }
        }
    }
    libs
}

fn installed(root: &Path) -> Vec<App> {
    let mut apps = Vec::new();
    for lib in libraries(root) {
        let Ok(rd) = fs::read_dir(lib.join("steamapps")) else { continue };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
                continue;
            }
            let Some(v) = read_vdf(&e.path()) else { continue };
            let Some(a) = get(&v, "AppState") else { continue };
            let appid = n(a, "appid");
            if appid == 0 || apps.iter().any(|x: &App| x.appid == appid) {
                continue;
            }
            apps.push(App {
                appid,
                name: s(a, "name").to_string(),
                flags: n(a, "StateFlags"),
                to_download: n(a, "BytesToDownload"),
                downloaded: n(a, "BytesDownloaded"),
                to_stage: n(a, "BytesToStage"),
                staged: n(a, "BytesStaged"),
                lib: lib.clone(),
            });
        }
    }
    apps
}

/// Compte connecté : SteamID64, dossier `userdata` et pseudo.
fn user(root: &Path) -> Option<(u64, PathBuf, String)> {
    let v = read_vdf(&root.join("config/loginusers.vdf"))?;
    let users = get(&v, "users")?.as_object()?;
    let (pick, u) = users.iter().max_by_key(|(_, u)| (s(u, "MostRecent") == "1", n(u, "Timestamp")))?;
    let id64: u64 = pick.parse().ok()?;
    let account = id64.checked_sub(76_561_197_960_265_728)?;
    Some((id64, root.join("userdata").join(account.to_string()), s(u, "PersonaName").to_string()))
}

/// Taille des fichiers d'un dossier (téléchargement en cours : `steamapps/downloading/<id>`).
fn dir_size(p: &Path, depth: u32) -> u64 {
    let Ok(rd) = fs::read_dir(p) else { return 0 };
    rd.flatten()
        .map(|e| match e.metadata() {
            Ok(m) if m.is_dir() && depth < 12 => dir_size(&e.path(), depth + 1),
            Ok(m) => m.len(),
            _ => 0,
        })
        .sum()
}

/// Statut voulu au dernier changement fait depuis Dot Steam, et quand.
static WANTED: Mutex<Option<(String, u64)>> = Mutex::new(None);

/// Change le statut Steam (`steam://friends/status/<statut>`) ; renvoie l'adresse à ouvrir.
pub fn status_url(status: &str) -> Option<String> {
    if !["online", "away", "invisible", "offline"].contains(&status) {
        return None;
    }
    *WANTED.lock().unwrap_or_else(|e| e.into_inner()) = Some((status.to_string(), now_ms()));
    Some(format!("steam://friends/status/{status}"))
}

/// Pages de Steam que Dot Steam peut ouvrir (`steam://open/<page>`).
pub fn open_url(page: &str) -> Option<String> {
    ["downloads", "library", "friends"].contains(&page).then(|| format!("steam://open/{page}"))
}

/// Avatar du compte connecté (cache de Steam : `config/avatarcache/<SteamID64>.png`).
pub fn avatar() -> Option<(PathBuf, &'static str)> {
    let root = steam_root(&registry())?;
    let (id64, _, _) = user(&root)?;
    let p = root.join("config/avatarcache").join(format!("{id64}.png"));
    p.is_file().then_some((p, "image/png"))
}

fn persona(code: u64) -> &'static str {
    match code {
        0 => "offline",
        1 | 2 | 5 | 6 => "online",
        3 | 4 => "away",
        7 => "invisible",
        _ => "online",
    }
}

/// Dernier lancement et temps de jeu (minutes) de chaque jeu.
fn played(userdir: &Path) -> HashMap<u64, (u64, u64)> {
    let mut out = HashMap::new();
    if let Some(v) = read_vdf(&userdir.join("config/localconfig.vdf")) {
        if let Some(Value::Object(apps)) = path(&v, &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"]) {
            for (k, a) in apps {
                if let Ok(id) = k.parse::<u64>() {
                    out.insert(id, (n(a, "LastPlayed"), n(a, "Playtime")));
                }
            }
        }
    }
    out
}

/// Liste choisie dans les réglages : liens Steam ou app IDs, séparés par des virgules.
fn chosen(list: &str) -> Vec<u64> {
    let mut out = Vec::new();
    for part in list.split([',', ';', '\n', ' ']) {
        let p = part.trim();
        if p.is_empty() {
            continue;
        }
        let digits: String = if let Some(i) = p.find("/app/") {
            p[i + 5..].chars().take_while(|c| c.is_ascii_digit()).collect()
        } else if let Some(i) = p.find("rungameid/") {
            p[i + 10..].chars().take_while(|c| c.is_ascii_digit()).collect()
        } else {
            p.chars().filter(|c| c.is_ascii_digit()).collect()
        };
        if let Ok(id) = digits.parse::<u64>() {
            if id > 0 && !out.contains(&id) {
                out.push(id);
            }
        }
    }
    out
}

// ---------------------------------------------------------------- état suivi entre deux lectures

struct Track {
    /// octets téléchargés et heure de la mesure, pour estimer le débit
    bytes: HashMap<u64, (u64, u64, f64)>,
    /// jeu en cours et heure à laquelle il a été vu la première fois
    playing: Option<(u64, u64)>,
}
static TRACK: Mutex<Option<Track>> = Mutex::new(None);

/// État complet pour le module (réponse de `GET /api/steam/state`).
pub fn state(settings: &Map<String, Value>, api_key: Option<String>) -> Value {
    let reg = registry();
    let Some(root) = steam_root(&reg) else {
        return json!({ "steam": { "found": false, "running": false }, "games": [], "downloads": [], "friends": { "enabled": false, "list": [] } });
    };
    let apps = installed(&root);
    let usr = user(&root);
    let times = usr.as_ref().map(|(_, d, _)| played(d)).unwrap_or_default();
    let running = reg.pid != 0;
    let now = now_ms();

    let mut guard = TRACK.lock().unwrap_or_else(|e| e.into_inner());
    let track = guard.get_or_insert_with(|| Track { bytes: HashMap::new(), playing: None });

    // jeu en cours
    let playing = if running && reg.running_app != 0 {
        let since = match track.playing {
            Some((id, t)) if id == reg.running_app => t,
            _ => now,
        };
        track.playing = Some((reg.running_app, since));
        let name = apps.iter().find(|a| a.appid == reg.running_app).map(|a| a.name.clone()).unwrap_or_else(|| format!("App {}", reg.running_app));
        json!({ "appid": reg.running_app, "name": name, "since": since })
    } else {
        track.playing = None;
        Value::Null
    };

    // jeux : la liste choisie, sinon les 8 derniers joués
    let game = |a: &App| {
        let (lp, pt) = times.get(&a.appid).copied().unwrap_or((0, 0));
        json!({ "appid": a.appid, "name": a.name, "lastPlayed": lp, "playtime": pt })
    };
    let pick = chosen(settings.get("games").and_then(Value::as_str).unwrap_or(""));
    let mut games: Vec<Value> = if !pick.is_empty() {
        pick.iter()
            .map(|id| match apps.iter().find(|a| a.appid == *id) {
                Some(a) => game(a),
                None => {
                    let (lp, pt) = times.get(id).copied().unwrap_or((0, 0));
                    json!({ "appid": id, "name": format!("App {id}"), "lastPlayed": lp, "playtime": pt, "installed": false })
                }
            })
            .collect()
    } else {
        let mut list: Vec<&App> = apps.iter().filter(|a| !is_tool(&a.name, a.appid)).collect();
        list.sort_by_key(|a| std::cmp::Reverse(times.get(&a.appid).map(|t| t.0).unwrap_or(0)));
        list.into_iter().take(8).map(game).collect()
    };
    games.truncate(8);
    let hero = games
        .iter()
        .max_by_key(|g| g["lastPlayed"].as_u64().unwrap_or(0))
        .and_then(|g| g["appid"].as_u64())
        .unwrap_or(0);

    // téléchargements : mises à jour et installations en cours, en pause ou en attente.
    // Steam n'écrit BytesDownloaded dans le manifeste que de temps en temps : pendant un téléchargement,
    // la taille de steamapps/downloading/<id> donne une progression et un débit à jour.
    let mut downs: Vec<(u8, Value)> = Vec::new();
    for a in apps.iter().filter(|a| !is_tool(&a.name, a.appid)) {
        let busy = a.flags & (UPDATE_RUNNING | DOWNLOADING | STAGING) != 0;
        let paused = a.flags & UPDATE_PAUSED != 0;
        let pending = a.to_download > 0 && a.downloaded < a.to_download;
        if !(busy || paused || pending || (a.flags & UPDATE_STARTED != 0 && a.flags & UPDATE_REQUIRED != 0)) {
            continue;
        }
        let status = if paused { "paused" } else if busy { "downloading" } else { "queued" };
        let mut disk = if busy { dir_size(&a.lib.join("steamapps/downloading").join(a.appid.to_string()), 0) } else { 0 };
        let mut progress: f64 = 0.0;
        if a.to_download > 0 {
            progress = progress.max(a.downloaded as f64 / a.to_download as f64);
        }
        // fichiers préalloués par Steam (dossier déjà plein alors que le manifeste dit moins de 90 %) : ignorés
        if a.to_stage > 0 && disk as f64 >= a.to_stage as f64 * 0.98 && progress < 0.9 {
            disk = 0;
        }
        if a.to_stage > 0 {
            progress = progress.max(a.staged as f64 / a.to_stage as f64).max(disk as f64 / a.to_stage as f64);
        }
        let progress = progress.min(1.0);
        let total = a.to_download.max(a.to_stage);
        // débit : octets reçus depuis la mesure précédente (manifeste ou dossier, le plus à jour)
        let bytes = a.downloaded.max(disk);
        let (mut speed, mut eta) = (Value::Null, Value::Null);
        if status == "downloading" {
            if let Some((b0, t0, sp0)) = track.bytes.get(&a.appid).copied() {
                let dt = (now.saturating_sub(t0)) as f64 / 1000.0;
                let mut sp = sp0;
                if dt >= 1.0 && bytes >= b0 {
                    let inst = (bytes - b0) as f64 / dt;
                    sp = if sp0 > 0.0 { sp0 * 0.6 + inst * 0.4 } else { inst };
                    track.bytes.insert(a.appid, (bytes, now, sp));
                }
                if sp > 0.0 {
                    speed = json!(sp.round() as u64);
                    if total > 0 {
                        eta = json!(((total as f64 * (1.0 - progress)) / sp).round() as u64);
                    }
                }
            } else {
                track.bytes.insert(a.appid, (bytes, now, 0.0));
            }
        } else {
            track.bytes.remove(&a.appid);
        }
        let rank = match status { "downloading" => 0, "paused" => 1, _ => 2 };
        downs.push((rank, json!({ "appid": a.appid, "name": a.name, "progress": progress, "total": total, "speed": speed, "eta": eta, "status": status })));
    }
    downs.sort_by_key(|(r, _)| *r);
    let downloads: Vec<Value> = downs.into_iter().map(|(_, v)| v).collect();
    drop(guard);

    // amis
    let show = settings.get("showFriends").map(|v| !matches!(v, Value::Bool(false)) && v.as_str() != Some("false")).unwrap_or(true);
    let key = api_key.filter(|k| !k.is_empty());
    let mut friends = match (&key, &usr) {
        (Some(k), Some((id64, _, _))) => friends(k, *id64),
        _ => json!({ "enabled": false, "list": [] }),
    };
    // profil : pseudo et avatar locaux ; statut = dernier changement fait ici, sinon l'API, sinon localconfig
    let profile = usr.as_ref().map(|(id64, dir, name)| {
        let api = friends.get("me").and_then(|m| m["status"].as_u64());
        let local = read_vdf(&dir.join("config/localconfig.vdf"))
            .and_then(|v| path(&v, &["UserLocalConfigStore", "friends"]).map(|f| n(f, "PersonaStateDesired")))
            .filter(|c| *c > 0);
        let wanted = WANTED.lock().unwrap_or_else(|e| e.into_inner()).clone();
        let status = match (wanted, api) {
            (Some((w, t)), a) if now.saturating_sub(t) < 120_000 || (w == "invisible" && a == Some(0)) => Some(w),
            (_, Some(a)) => Some(persona(a).to_string()),
            _ => local.map(|c| persona(c).to_string()),
        };
        let avatar = steam_root(&reg).map(|r| r.join("config/avatarcache").join(format!("{id64}.png")).is_file()).unwrap_or(false);
        json!({ "name": name, "avatar": avatar, "status": if running { status } else { Some("offline".to_string()) } })
    });
    if let Some(m) = friends.as_object_mut() {
        m.remove("me");
    }
    if !show {
        friends = json!({ "enabled": false, "hidden": true, "list": [] });
    }

    json!({
        "steam": { "found": true, "running": running },
        "playing": playing,
        "hero": hero,
        "games": games,
        "downloads": downloads,
        "friends": friends,
        "profile": profile,
    })
}

// ---------------------------------------------------------------- amis (API Web Steam)

struct FriendCache {
    key_hash: u64,
    at: u64,
    busy: bool,
    value: Value,
}
static FRIENDS: Mutex<Option<FriendCache>> = Mutex::new(None);

fn hash(s: &str) -> u64 {
    s.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100_0000_01b3))
}

/// Requête HTTPS avec curl (fourni avec Windows 10 et 11) ; l'adresse passe par l'entrée standard,
/// pour que la clé d'API n'apparaisse pas dans la liste des processus.
fn curl(url: &str, out: Option<&Path>) -> Option<Vec<u8>> {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let mut cmd = Command::new("curl");
    cmd.args(["-s", "-f", "-L", "-m", "10", "-K", "-"]);
    if let Some(p) = out {
        cmd.arg("-o").arg(p);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let mut child = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().ok()?;
    child.stdin.take()?.write_all(format!("url = \"{url}\"\n").as_bytes()).ok()?;
    let o = child.wait_with_output().ok()?;
    if o.status.success() {
        Some(o.stdout)
    } else {
        None
    }
}

fn fetch_friends(key: &str, id64: u64) -> Value {
    let base = "https://api.steampowered.com";
    let list = match curl(&format!("{base}/ISteamUser/GetFriendList/v1/?key={key}&steamid={id64}&relationship=friend"), None)
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
    {
        Some(v) => v,
        None => return json!({ "enabled": true, "error": "Friends unavailable · check the API key", "list": [] }),
    };
    let ids: Vec<String> = list["friendslist"]["friends"]
        .as_array()
        .map(|a| a.iter().filter_map(|f| f["steamid"].as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    let mut people = Vec::new();
    let mut me = Value::Null;
    let mut ids = ids;
    ids.insert(0, id64.to_string());
    for chunk in ids.chunks(100) {
        if let Some(v) = curl(&format!("{base}/ISteamUser/GetPlayerSummaries/v2/?key={key}&steamids={}", chunk.join(",")), None)
            .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        {
            if let Some(ps) = v["response"]["players"].as_array() {
                for p in ps {
                    let state = p["personastate"].as_u64().unwrap_or(0);
                    if p["steamid"].as_str() == Some(&id64.to_string()) {
                        me = json!({ "status": state });
                        continue;
                    }
                    people.push(json!({
                        "name": p["personaname"].as_str().unwrap_or(""),
                        "game": p["gameextrainfo"].as_str(),
                        "online": state != 0,
                    }));
                }
            }
        }
    }
    // en jeu d'abord, puis en ligne, puis par nom
    people.sort_by(|a, b| {
        let ka = (a["game"].is_null(), !a["online"].as_bool().unwrap_or(false), a["name"].as_str().unwrap_or("").to_lowercase());
        let kb = (b["game"].is_null(), !b["online"].as_bool().unwrap_or(false), b["name"].as_str().unwrap_or("").to_lowercase());
        ka.cmp(&kb)
    });
    json!({ "enabled": true, "error": null, "list": people, "me": me })
}

fn friends(key: &str, id64: u64) -> Value {
    let kh = hash(key);
    let now = now_ms();
    let mut g = FRIENDS.lock().unwrap_or_else(|e| e.into_inner());
    let fresh = matches!(g.as_ref(), Some(c) if c.key_hash == kh && now.saturating_sub(c.at) < 60_000);
    let busy = matches!(g.as_ref(), Some(c) if c.busy);
    if !fresh && !busy {
        let prev = g.as_ref().filter(|c| c.key_hash == kh).map(|c| c.value.clone()).unwrap_or(json!({ "enabled": true, "error": null, "list": [] }));
        *g = Some(FriendCache { key_hash: kh, at: now, busy: true, value: prev });
        let key = key.to_string();
        std::thread::spawn(move || {
            let v = fetch_friends(&key, id64);
            let mut g = FRIENDS.lock().unwrap_or_else(|e| e.into_inner());
            *g = Some(FriendCache { key_hash: kh, at: now_ms(), busy: false, value: v });
        });
    }
    g.as_ref().map(|c| c.value.clone()).unwrap_or(json!({ "enabled": true, "error": null, "list": [] }))
}

// ---------------------------------------------------------------- jaquettes

/// Fichier image d'une jaquette : `portrait` (600 × 900) ou `wide` (460 × 215).
pub fn art(appid: u64, kind: &str, cache_dir: &Path) -> Option<(PathBuf, &'static str)> {
    let names: &[&str] = if kind == "wide" { &["header.jpg", "library_header.jpg"] } else { &["library_600x900.jpg", "library_600x900_2x.jpg"] };
    let reg = registry();
    if let Some(root) = steam_root(&reg) {
        let lc = root.join("appcache/librarycache");
        for nm in names {
            for p in [lc.join(format!("{appid}_{nm}")), lc.join(appid.to_string()).join(nm)] {
                if p.is_file() {
                    return Some((p, "image/jpeg"));
                }
            }
            // nouveau cache : librarycache/<appid>/<empreinte>/<nom>
            if let Ok(rd) = fs::read_dir(lc.join(appid.to_string())) {
                for e in rd.flatten() {
                    let p = e.path().join(nm);
                    if p.is_file() {
                        return Some((p, "image/jpeg"));
                    }
                }
            }
        }
    }
    // images publiques du magasin, téléchargées une fois
    let _ = fs::create_dir_all(cache_dir);
    let file = cache_dir.join(format!("{appid}_{}", names[0]));
    let miss = cache_dir.join(format!("{appid}_{}.missing", names[0]));
    if file.is_file() {
        return Some((file, "image/jpeg"));
    }
    if let Ok(m) = fs::metadata(&miss) {
        let recent = m.modified().ok().and_then(|t| t.elapsed().ok()).map(|e| e.as_secs() < 3600).unwrap_or(false);
        if recent {
            return None;
        }
    }
    // téléchargement en arrière-plan : le serveur ne bloque jamais, le module redemande l'image plus tard
    let tag = format!("{appid}_{}", names[0]);
    {
        let mut g = INFLIGHT.lock().unwrap_or_else(|e| e.into_inner());
        if g.contains(&tag) {
            return None;
        }
        g.push(tag.clone());
    }
    let urls = [
        format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/{}", names[0]),
        format!("https://cdn.akamai.steamstatic.com/steam/apps/{appid}/{}", names[1]),
    ];
    let tmp = cache_dir.join(format!("{tag}.part"));
    std::thread::spawn(move || {
        let ok = urls.iter().any(|u| curl(u, Some(&tmp)).is_some() && fs::metadata(&tmp).map(|m| m.len() > 0).unwrap_or(false));
        if ok {
            let _ = fs::rename(&tmp, &file);
        } else {
            let _ = fs::remove_file(&tmp);
            let _ = fs::write(&miss, b"");
        }
        INFLIGHT.lock().unwrap_or_else(|e| e.into_inner()).retain(|t| t != &tag);
    });
    None
}

static INFLIGHT: Mutex<Vec<String>> = Mutex::new(Vec::new());

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vdf() {
        let v = parse_vdf("\"AppState\"\n{\n\t\"appid\"\t\t\"620\"\n\t\"name\"\t\t\"Portal \\\"2\\\"\"\n\t// commentaire\n\t\"UserConfig\" { \"language\" \"french\" }\n}\n");
        assert_eq!(s(get(&v, "appstate").unwrap(), "APPID"), "620");
        assert_eq!(s(get(&v, "AppState").unwrap(), "name"), "Portal \"2\"");
        assert_eq!(s(path(&v, &["AppState", "UserConfig"]).unwrap(), "language"), "french");
    }

    #[test]
    fn statuts() {
        assert_eq!(status_url("invisible").as_deref(), Some("steam://friends/status/invisible"));
        assert_eq!(status_url("x\"; calc"), None);
        assert_eq!(open_url("downloads").as_deref(), Some("steam://open/downloads"));
        assert_eq!(open_url("../x"), None);
        assert_eq!(persona(3), "away");
    }

    #[test]
    fn choix() {
        assert_eq!(chosen("620, https://store.steampowered.com/app/1145360/Hades/, steam://rungameid/570 620"), vec![620, 1145360, 570]);
    }
}
