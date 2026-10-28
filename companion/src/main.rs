//! Dot Companion : programme Windows qui sert Dot Hub.
//!
//! - sous Windows : pas de fenêtre, une icône dans la zone de notification (voir `tray.rs`) ;
//! - mise à jour depuis l'app, à partir des releases GitHub (voir `update.rs`) ;
//! - écoute uniquement sur 127.0.0.1 (port 47800) ;
//! - sert l'accueil Dot Hub, la page de réglages et les modules (pour l'instant : Clock) ;
//! - ouvre la page de réglages dans le navigateur du PC quand on touche SETTINGS sur l'Edge ;
//! - module Steam (Dot Steam) : jeux, téléchargements, jeu en cours, amis, lancement (voir `steam.rs`) ;
//! - garde les secrets des modules (clés d'API) chiffrés avec DPAPI sous Windows ;
//! - garde les pages de Dot Hub (un module ajouté avec « + » et ses réglages, communes à tous les Dot Hub),
//!   la page affichée par chaque Dot Hub (clé = `uniqueId` iCUE) et les couleurs communes
//!   dans `%APPDATA%\Xeneon\config.json`.

// sous Windows : pas de console (l'icône de la zone de notification la remplace) ; la console reste en debug
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

use include_dir::{include_dir, Dir};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

mod steam;
#[cfg(any(windows, feature = "check-win"))]
mod tray;
mod update;

const PORT: u16 = 47800;
const VERSION: &str = env!("CARGO_PKG_VERSION");

static WEB: Dir = include_dir!("$CARGO_MANIFEST_DIR/web");
static CLOCK: Dir = include_dir!("$CARGO_MANIFEST_DIR/../widgets/dot-clock");
static STEAM: Dir = include_dir!("$CARGO_MANIFEST_DIR/../widgets/dot-steam");

struct Module {
    id: &'static str,
    name: &'static str,
    files: &'static Dir<'static>,
}

fn modules() -> Vec<Module> {
    vec![
        Module { id: "clock", name: "Dot Clock", files: &CLOCK },
        Module { id: "steam", name: "Dot Steam", files: &STEAM },
    ]
}

// ---------------------------------------------------------------- configuration

#[derive(Serialize, Deserialize, Default)]
struct Config {
    #[serde(default)]
    instances: BTreeMap<String, Instance>,
    /// pages de Dot Hub, dans l'ordre des tuiles de l'accueil (communes à tous les Dot Hub)
    #[serde(default)]
    pages: Vec<Page>,
    /// couleurs communes à tous les modules (page de réglages, carte « Paramètres globaux »)
    #[serde(default)]
    theme: Map<String, Value>,
    #[serde(default)]
    theme_version: u64,
    /// démarrage avec Windows déjà réglé une fois (activé à la première ouverture, puis au choix de l'utilisateur)
    #[serde(default)]
    startup_done: bool,
}

/// Démarrage avec Windows : valeur « Dot Companion » de la clé Run de l'utilisateur (sans droits administrateur).
mod startup {
    #[cfg(windows)]
    const KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    #[cfg(windows)]
    const NAME: &str = "Dot Companion";

    #[cfg(windows)]
    fn reg(args: &[&str]) -> bool {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("reg")
            .args(args)
            .creation_flags(0x0800_0000)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub fn supported() -> bool {
        cfg!(windows)
    }

    #[cfg(windows)]
    pub fn enabled() -> bool {
        reg(&["query", KEY, "/v", NAME])
    }
    #[cfg(not(windows))]
    pub fn enabled() -> bool {
        false
    }

    #[cfg(windows)]
    pub fn set(on: bool) -> bool {
        if on {
            let Ok(exe) = std::env::current_exe() else { return false };
            let value = format!("\"{}\"", exe.display());
            reg(&["add", KEY, "/v", NAME, "/t", "REG_SZ", "/d", &value, "/f"])
        } else {
            !enabled() || reg(&["delete", KEY, "/v", NAME, "/f"])
        }
    }
    #[cfg(not(windows))]
    pub fn set(_on: bool) -> bool {
        false
    }
}

/// Réglages de couleur communs : mêmes noms que les x-icue-property des modules.
const THEME_DEFAULTS: [(&str, &str); 4] = [
    ("dotAccentColor", "#10B981"),
    ("litDotColor", "#F2F0E9"),
    ("unlitDotColor", "#1C1C1C"),
    ("labelColor", "#B8B6B0"),
];

fn theme_full(cfg: &Config) -> Map<String, Value> {
    let mut t = Map::new();
    for (k, d) in THEME_DEFAULTS {
        let v = cfg.theme.get(k).and_then(Value::as_str).unwrap_or(d);
        t.insert(k.to_string(), Value::String(v.to_string()));
    }
    t
}

/// Page de Dot Hub : un module ajouté avec « + » (carte DOT HUB de la page de réglages, ou accueil sur l'Edge),
/// avec ses réglages. Les pages sont communes à tous les Dot Hub ; chaque Dot Hub affiche l'une d'elles, ou l'accueil.
#[derive(Serialize, Deserialize, Default, Clone)]
struct Page {
    id: String,
    module: String,
    #[serde(default)]
    settings: Map<String, Value>,
    #[serde(default)]
    version: u64,
}

/// Un Dot Hub posé dans iCUE (clé = `uniqueId`) : la page qu'il affiche.
#[derive(Serialize, Deserialize, Default, Clone)]
struct Instance {
    #[serde(default)]
    name: String,
    /// page affichée ; aucune : l'accueil
    #[serde(default, skip_serializing_if = "Option::is_none")]
    page: Option<String>,
    /// jusqu'à 0.4.0 : module et réglages propres à chaque Dot Hub, repris en pages au démarrage (voir `migrate`)
    #[serde(default, skip_serializing)]
    module: Option<String>,
    #[serde(default, skip_serializing)]
    settings: Map<String, Value>,
    #[serde(default)]
    version: u64,
    #[serde(default)]
    identify: u64,
    #[serde(default)]
    last_seen: u64,
}

fn config_path() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("Xeneon").join("config.json")
}

fn load_config() -> Config {
    match fs::read_to_string(config_path()) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_else(|e| {
            eprintln!("config.json illisible ({e}) : configuration vide");
            Config::default()
        }),
        Err(_) => Config::default(),
    }
}

fn save_config(cfg: &Config) {
    let path = config_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let tmp = path.with_extension("json.tmp");
    match serde_json::to_string_pretty(cfg) {
        Ok(text) => {
            if fs::write(&tmp, text).and_then(|_| fs::rename(&tmp, &path)).is_err() {
                eprintln!("impossible d'écrire {}", path.display());
            }
        }
        Err(e) => eprintln!("configuration non sérialisable : {e}"),
    }
}

/// Configuration d'avant 0.5.0 : chaque Dot Hub avait son module et ses réglages. Chacun devient une page
/// (une seule par module et réglages identiques), que le Dot Hub continue d'afficher.
fn migrate(cfg: &mut Config) -> bool {
    let mut changed = false;
    let uids: Vec<String> = cfg.instances.keys().cloned().collect();
    for uid in uids {
        let (module, settings) = {
            let inst = &cfg.instances[&uid];
            (inst.module.clone(), inst.settings.clone())
        };
        let Some(module) = module else { continue };
        changed = true;
        let id = match cfg.pages.iter().find(|p| p.module == module && p.settings == settings) {
            Some(p) => p.id.clone(),
            None => new_page(cfg, &module, settings),
        };
        let inst = cfg.instances.get_mut(&uid).expect("instance");
        if inst.page.is_none() {
            inst.page = Some(id);
        }
        inst.module = None;
        inst.settings = Map::new();
    }
    changed
}

/// Ajoute une page en fin de liste (dernière tuile de l'accueil) et renvoie son identifiant.
fn new_page(cfg: &mut Config, module: &str, settings: Map<String, Value>) -> String {
    let mut n = now_ms();
    let id = loop {
        let id = format!("p{n:x}");
        if !cfg.pages.iter().any(|p| p.id == id) {
            break id;
        }
        n += 1;
    };
    cfg.pages.push(Page { id: id.clone(), module: module.to_string(), settings, version: 1 });
    id
}

fn module_ok(id: &str) -> bool {
    modules().iter().any(|m| m.id == id)
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ---------------------------------------------------------------- outils HTTP

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("en-tête valide")
}

fn mime(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "woff2" => "font/woff2",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn send(req: Request, status: u16, ctype: &str, body: Vec<u8>) {
    let resp = Response::from_data(body)
        .with_status_code(StatusCode(status))
        .with_header(header("Content-Type", ctype))
        .with_header(header("Cache-Control", "no-store"))
        .with_header(header("Access-Control-Allow-Origin", "*"));
    let _ = req.respond(resp);
}

fn send_json(req: Request, status: u16, value: &Value) {
    send(req, status, "application/json; charset=utf-8", value.to_string().into_bytes());
}

fn redirect(req: Request, to: &str) {
    let resp = Response::empty(StatusCode(302))
        .with_header(header("Location", to))
        .with_header(header("Cache-Control", "no-store"));
    let _ = req.respond(resp);
}

fn not_found(req: Request) {
    send(req, 404, "text/plain; charset=utf-8", b"Not found".to_vec());
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(if bytes[i] == b'+' { b' ' } else { bytes[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Refuse les requêtes dont l'en-tête Host n'est pas la machine locale (protection contre le DNS rebinding).
fn host_ok(req: &Request) -> bool {
    req.headers()
        .iter()
        .find(|h| h.field.equiv("Host"))
        .map(|h| {
            let v = h.value.as_str();
            v == format!("127.0.0.1:{PORT}") || v == format!("localhost:{PORT}")
        })
        .unwrap_or(false)
}

fn serve_file(req: Request, dir: &Dir, path: &str, inject: bool) {
    let path = if path.is_empty() || path.ends_with('/') { format!("{path}index.html") } else { path.to_string() };
    if path.split('/').any(|p| p == "..") {
        return not_found(req);
    }
    match dir.get_file(&path) {
        Some(f) => {
            let mut body = f.contents().to_vec();
            if inject && path.ends_with("index.html") {
                let html = String::from_utf8_lossy(&body);
                body = html
                    .replacen("</body>", "<script src=\"/hub/module.js\"></script>\n</body>", 1)
                    .into_bytes();
            }
            send(req, 200, mime(&path), body);
        }
        None => not_found(req),
    }
}

// ---------------------------------------------------------------- routes

fn handle(mut req: Request, cfg: &mut Config) {
    if !host_ok(&req) {
        return send(req, 403, "text/plain; charset=utf-8", b"Forbidden host".to_vec());
    }
    let url = req.url().to_string();
    let path = url.split('?').next().unwrap_or("").to_string();
    let method = req.method().clone();

    if method == Method::Options {
        let resp = Response::empty(StatusCode(204))
            .with_header(header("Access-Control-Allow-Origin", "*"))
            .with_header(header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE"))
            .with_header(header("Access-Control-Allow-Headers", "Content-Type"));
        let _ = req.respond(resp);
        return;
    }

    let segs: Vec<String> = path.trim_start_matches('/').split('/').map(percent_decode).collect();
    let seg = |i: usize| segs.get(i).map(String::as_str).unwrap_or("");

    match (&method, seg(0)) {
        (Method::Get, "") => redirect(req, "/settings"),
        (Method::Get, "settings") => serve_file(req, &WEB, "settings.html", false),
        (Method::Get, "home") => serve_file(req, &WEB, "home.html", false),
        (Method::Get, "hub") => serve_file(req, &WEB, &format!("hub/{}", segs[1..].join("/")), false),

        // point d'entrée de la coquille : /i/<uniqueId> → la page affichée par ce Dot Hub, ou l'accueil
        (Method::Get, "i") => {
            let uid = seg(1).to_string();
            if uid.is_empty() {
                return not_found(req);
            }
            seen(&uid);
            let inst = cfg.instances.entry(uid.clone()).or_default();
            inst.last_seen = now_ms();
            let page = inst.page.clone();
            let target = page.and_then(|id| cfg.pages.iter().find(|p| p.id == id && module_ok(&p.module)).map(|p| (p.module.clone(), p.id.clone())));
            save_config(cfg);
            let q = format!("uid={}", url_encode(&uid));
            match target {
                Some((m, id)) => redirect(req, &format!("/m/{m}/?{q}&page={}", url_encode(&id))),
                None => redirect(req, &format!("/home?{q}")),
            }
        }

        // fichiers d'un module : /m/<id>/...
        (Method::Get, "m") => {
            let id = seg(1);
            match modules().into_iter().find(|m| m.id == id) {
                Some(m) => serve_file(req, m.files, &segs[2..].join("/"), true),
                None => not_found(req),
            }
        }

        (Method::Get, "api") => match seg(1) {
            "health" => send_json(req, 200, &json!({ "ok": true, "name": "Dot Companion", "version": VERSION, "port": PORT })),
            "modules" => {
                let list: Vec<Value> = modules().iter().map(|m| json!({ "id": m.id, "name": m.name })).collect();
                send_json(req, 200, &Value::Array(list))
            }
            "instances" => {
                let m: Map<String, Value> = cfg.instances.iter().map(|(k, i)| (k.clone(), instance_json(cfg, k, i))).collect();
                send_json(req, 200, &Value::Object(m))
            }
            "pages" => send_json(req, 200, &Value::Array(cfg.pages.iter().map(page_json).collect())),
            "page" => match cfg.pages.iter().find(|p| p.id == seg(2)) {
                Some(p) => send_json(req, 200, &page_json(p)),
                None => send_json(req, 404, &json!({ "error": "unknown page" })),
            },
            // Dot Steam : état de Steam pour une page (ses réglages : jeux choisis, clé d'API des amis) ;
            // ?page=<id> (aperçu de la page de réglages), sinon la page affichée par le Dot Hub ?uid=<uniqueId>
            "steam" if seg(2) == "state" => {
                let mut page = query(&url, "page");
                if page.is_empty() {
                    page = cfg.instances.get(&query(&url, "uid")).and_then(|i| i.page.clone()).unwrap_or_default();
                }
                let settings = cfg.pages.iter().find(|p| p.id == page).map(|p| p.settings.clone()).unwrap_or_default();
                let key = settings.get("steamApiKey").and_then(Value::as_str).and_then(unseal);
                send_json(req, 200, &steam::state(&settings, key))
            }
            // Dot Steam : avatar du compte connecté (cache de Steam)
            "steam" if seg(2) == "avatar" => match steam::avatar().and_then(|(p, ctype)| fs::read(p).ok().map(|b| (b, ctype))) {
                Some((b, ctype)) => {
                    let _ = req.respond(Response::from_data(b).with_header(header("Content-Type", ctype)).with_header(header("Cache-Control", "max-age=300")));
                }
                None => not_found(req),
            },
            "steam" if seg(2) == "art" => {
                let id: u64 = seg(3).parse().unwrap_or(0);
                match (id > 0).then(|| steam::art(id, seg(4), &cache_dir())).flatten() {
                    Some((p, ctype)) => match fs::read(&p) {
                        Ok(b) => {
                            let resp = Response::from_data(b)
                                .with_header(header("Content-Type", ctype))
                                .with_header(header("Cache-Control", "max-age=86400"));
                            let _ = req.respond(resp);
                        }
                        Err(_) => not_found(req),
                    },
                    None => not_found(req),
                }
            }
            "update" => send_json(req, 200, &update::status_json()),
            "startup" => send_json(req, 200, &json!({ "supported": startup::supported(), "enabled": startup::enabled() })),
            "theme" => send_json(req, 200, &json!({ "theme": theme_full(cfg), "version": cfg.theme_version, "defaults": THEME_DEFAULTS.iter().map(|(k, v)| (k.to_string(), Value::String(v.to_string()))).collect::<Map<String, Value>>() })),
            "instance" => match cfg.instances.get(seg(2)) {
                Some(inst) => {
                    seen(seg(2));
                    let mut v = instance_json(cfg, seg(2), inst);
                    v["theme"] = Value::Object(theme_full(cfg));
                    v["theme_version"] = json!(cfg.theme_version);
                    send_json(req, 200, &v)
                }
                None => send_json(req, 404, &json!({ "error": "unknown instance" })),
            },
            _ => not_found(req),
        },

        // mise à jour depuis l'app : vérifier maintenant, installer la version disponible (le compagnon redémarre)
        (Method::Post, "api") if seg(1) == "update" => {
            match seg(2) {
                "check" => update::check_async(),
                "install" => update::install_async(),
                _ => return not_found(req),
            }
            send_json(req, 200, &update::status_json())
        }

        // démarrage avec Windows (carte « Paramètres globaux » de la page de réglages)
        (Method::Put, "api") if seg(1) == "startup" => {
            let mut body = String::new();
            let _ = req.as_reader().take(1 << 12).read_to_string(&mut body);
            match serde_json::from_str::<Value>(&body).ok().and_then(|v| v.get("enabled").and_then(Value::as_bool)) {
                Some(on) => {
                    let ok = startup::set(on);
                    cfg.startup_done = true;
                    save_config(cfg);
                    send_json(req, if ok { 200 } else { 500 }, &json!({ "ok": ok, "supported": startup::supported(), "enabled": startup::enabled() }))
                }
                None => send_json(req, 400, &json!({ "error": "expected {\"enabled\": true|false}" })),
            }
        }

        (Method::Put, "api") if seg(1) == "theme" => {
            let mut body = String::new();
            let _ = req.as_reader().take(1 << 16).read_to_string(&mut body);
            match serde_json::from_str::<Value>(&body) {
                Ok(Value::Object(m)) => {
                    cfg.theme = m
                        .into_iter()
                        .filter(|(k, v)| THEME_DEFAULTS.iter().any(|(d, _)| d == k) && v.is_string())
                        .collect();
                    cfg.theme_version += 1;
                    save_config(cfg);
                    send_json(req, 200, &json!({ "theme": theme_full(cfg), "version": cfg.theme_version }))
                }
                _ => send_json(req, 400, &json!({ "error": "invalid JSON" })),
            }
        }

        // la page affichée par un Dot Hub : { "page": "<id>" | null } (tuile touchée sur l'accueil de l'Edge)
        (Method::Put, "api") if seg(1) == "instance" => {
            let uid = seg(2).to_string();
            let patch = match read_json(&mut req, 1 << 16) {
                Some(v) => v,
                None => return send_json(req, 400, &json!({ "error": "invalid JSON" })),
            };
            let mut page = cfg.instances.get(&uid).and_then(|i| i.page.clone());
            match patch.get("page") {
                Some(Value::Null) => page = None,
                Some(Value::String(id)) => {
                    if !cfg.pages.iter().any(|p| &p.id == id) {
                        return send_json(req, 404, &json!({ "error": "unknown page" }));
                    }
                    page = Some(id.clone());
                }
                _ => {}
            }
            // jusqu'à 0.4.0 : { "module": "<id>" } ; la première page de ce module, créée au besoin
            if let Some(m) = patch.get("module") {
                page = match m.as_str().filter(|m| module_ok(m)) {
                    Some(m) => Some(match cfg.pages.iter().find(|p| p.module == m) {
                        Some(p) => p.id.clone(),
                        None => new_page(cfg, m, Map::new()),
                    }),
                    None => None,
                };
            }
            let inst = cfg.instances.entry(uid.clone()).or_default();
            if let Some(n) = patch.get("name").and_then(Value::as_str) {
                inst.name = n.chars().take(40).collect();
            }
            inst.page = page;
            inst.version += 1;
            let out = instance_json(cfg, &uid, &cfg.instances[&uid]);
            save_config(cfg);
            send_json(req, 200, &out)
        }

        // ajouter une page : { "module": "<id>" } ; elle devient la dernière tuile de l'accueil
        (Method::Post, "api") if seg(1) == "pages" => {
            let module = read_json(&mut req, 1 << 12).and_then(|v| v.get("module").and_then(Value::as_str).map(str::to_string));
            match module.filter(|m| module_ok(m)) {
                Some(m) => {
                    let id = new_page(cfg, &m, Map::new());
                    save_config(cfg);
                    let p = cfg.pages.iter().find(|p| p.id == id).expect("page ajoutée");
                    send_json(req, 200, &page_json(p))
                }
                None => send_json(req, 400, &json!({ "error": "expected {\"module\": \"<module id>\"}" })),
            }
        }

        // réglages d'une page : { "settings": { … } } (secrets : voir `merge_settings`)
        (Method::Put, "api") if seg(1) == "page" => {
            let id = seg(2).to_string();
            let patch = match read_json(&mut req, 1 << 20) {
                Some(v) => v,
                None => return send_json(req, 400, &json!({ "error": "invalid JSON" })),
            };
            let Some(p) = cfg.pages.iter_mut().find(|p| p.id == id) else {
                return send_json(req, 404, &json!({ "error": "unknown page" }));
            };
            if let Some(Value::Object(s)) = patch.get("settings") {
                p.settings = merge_settings(&p.settings, s.clone());
            }
            p.version += 1;
            let out = page_json(p);
            save_config(cfg);
            send_json(req, 200, &out)
        }

        // retirer une page : les Dot Hub qui l'affichaient reviennent à l'accueil
        (Method::Delete, "api") if seg(1) == "page" => {
            let id = seg(2).to_string();
            let before = cfg.pages.len();
            cfg.pages.retain(|p| p.id != id);
            if cfg.pages.len() == before {
                return send_json(req, 404, &json!({ "error": "unknown page" }));
            }
            for inst in cfg.instances.values_mut() {
                if inst.page.as_deref() == Some(id.as_str()) {
                    inst.page = None;
                    inst.version += 1;
                }
            }
            save_config(cfg);
            send_json(req, 200, &json!({ "ok": true }))
        }

        (Method::Post, "api") if seg(1) == "instance" && seg(3) == "identify" => match cfg.instances.get_mut(seg(2)) {
            Some(inst) => {
                inst.identify = now_ms();
                send_json(req, 200, &json!({ "ok": true }))
            }
            None => send_json(req, 404, &json!({ "error": "unknown instance" })),
        },

        // bouton SETTINGS de l'accueil : ouvre les réglages dans le navigateur du PC
        (Method::Post, "api") if seg(1) == "open-settings" => {
            let ok = open_settings();
            send_json(req, if ok { 200 } else { 500 }, &json!({ "ok": ok }))
        }

        // Dot Steam : lancer un jeu (steam://rungameid/<id>, Steam démarre d'abord s'il est fermé)
        (Method::Post, "api") if seg(1) == "steam" && seg(2) == "launch" => {
            let id: u64 = seg(3).parse().unwrap_or(0);
            let ok = id > 0 && open_url(&format!("steam://rungameid/{id}"));
            send_json(req, if ok { 200 } else { 400 }, &json!({ "ok": ok }))
        }

        // Dot Steam : ouvrir une page de Steam (téléchargements…) et changer son statut ; listes fermées
        (Method::Post, "api") if seg(1) == "steam" && (seg(2) == "open" || seg(2) == "status") => {
            let url = if seg(2) == "open" { steam::open_url(seg(3)) } else { steam::status_url(seg(3)) };
            let ok = url.map(|u| open_url(&u)).unwrap_or(false);
            send_json(req, if ok { 200 } else { 400 }, &json!({ "ok": ok }))
        }

        (Method::Delete, "api") if seg(1) == "instance" => {
            cfg.instances.remove(seg(2));
            save_config(cfg);
            send_json(req, 200, &json!({ "ok": true }))
        }

        _ => not_found(req),
    }
}

/// Ouvre la page de réglages dans le navigateur par défaut du PC.
/// Un seul appel toutes les 3 s, pour ne pas ouvrir plusieurs onglets sur un double toucher.
static LAST_OPEN: AtomicU64 = AtomicU64::new(0);

fn open_settings() -> bool {
    let now = now_ms();
    let last = LAST_OPEN.load(Ordering::Relaxed);
    if now.saturating_sub(last) < 3000 {
        return true;
    }
    LAST_OPEN.store(now, Ordering::Relaxed);
    open_url(&format!("http://127.0.0.1:{PORT}/settings"))
}

// ---------------------------------------------------------------- état partagé (serveur et icône)

/// Configuration, partagée entre le serveur HTTP et l'icône de la zone de notification.
static CFG: OnceLock<Mutex<Config>> = OnceLock::new();

fn cfg() -> MutexGuard<'static, Config> {
    CFG.get_or_init(|| Mutex::new(Config::default())).lock().unwrap_or_else(|e| e.into_inner())
}

/// Dernier contact de chaque Dot Hub (en mémoire) : un Dot Hub est « connecté » s'il a parlé au compagnon depuis 60 s.
static SEEN: Mutex<Option<HashMap<String, u64>>> = Mutex::new(None);

fn seen(uid: &str) {
    let mut g = SEEN.lock().unwrap_or_else(|e| e.into_inner());
    g.get_or_insert_with(HashMap::new).insert(uid.to_string(), now_ms());
}

fn connected(uid: &str) -> bool {
    let now = now_ms();
    let g = SEEN.lock().unwrap_or_else(|e| e.into_inner());
    g.as_ref().and_then(|m| m.get(uid)).map(|t| now.saturating_sub(*t) < 60_000).unwrap_or(false)
}

#[cfg_attr(not(any(windows, feature = "check-win")), allow(dead_code))] // menu de l'icône (Windows)
fn connected_count() -> usize {
    let now = now_ms();
    let g = SEEN.lock().unwrap_or_else(|e| e.into_inner());
    g.as_ref().map(|m| m.values().filter(|t| now.saturating_sub(**t) < 60_000).count()).unwrap_or(0)
}

/// « Identifier les Dot Hub » (menu de l'icône) : chaque Dot Hub affiche son nom pendant 3 s.
#[cfg_attr(not(any(windows, feature = "check-win")), allow(dead_code))] // menu de l'icône (Windows)
fn identify_all() {
    let now = now_ms();
    for inst in cfg().instances.values_mut() {
        inst.identify = now;
    }
}

/// Quitte le compagnon (menu de l'icône, ou redémarrage après une mise à jour).
fn quit() -> ! {
    #[cfg(any(windows, feature = "check-win"))]
    tray::remove();
    std::process::exit(0)
}

/// Ouvre une adresse avec le programme associé du PC (navigateur, Steam pour `steam://`…).
fn open_url(url: &str) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .is_ok()
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open").arg(url).spawn().is_ok()
    }
}

// ---------------------------------------------------------------- secrets des modules

/// Réglages secrets : jamais renvoyés en clair, gardés chiffrés (DPAPI, liés au compte Windows).
const SECRET_KEYS: [&str; 1] = ["steamApiKey"];
const MASK: &str = "••••••••";

fn b64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for k in 0..4 {
            if k <= c.len() {
                out.push(T[(n >> (18 - 6 * k) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

fn unb64(s: &str) -> Option<Vec<u8>> {
    let val = |c: u8| -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32)
    };
    let bytes: Vec<u8> = s.bytes().filter(|c| *c != b'=').collect();
    let mut out = Vec::new();
    for c in bytes.chunks(4) {
        let mut n = 0u32;
        for (k, b) in c.iter().enumerate() {
            n |= val(*b)? << (18 - 6 * k);
        }
        for k in 0..c.len().saturating_sub(1) {
            out.push((n >> (16 - 8 * k) & 255) as u8);
        }
    }
    Some(out)
}

#[cfg(windows)]
mod dpapi {
    use std::ffi::c_void;
    #[repr(C)]
    struct Blob {
        cb: u32,
        pb: *mut u8,
    }
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(i: *const Blob, d: *const u16, e: *const Blob, r: *mut c_void, p: *mut c_void, f: u32, o: *mut Blob) -> i32;
        fn CryptUnprotectData(i: *const Blob, d: *mut *mut u16, e: *const Blob, r: *mut c_void, p: *mut c_void, f: u32, o: *mut Blob) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(h: *mut c_void) -> *mut c_void;
    }
    const UI_FORBIDDEN: u32 = 1;
    fn run(data: &[u8], protect: bool) -> Option<Vec<u8>> {
        let mut buf = data.to_vec();
        let input = Blob { cb: buf.len() as u32, pb: buf.as_mut_ptr() };
        let mut out = Blob { cb: 0, pb: std::ptr::null_mut() };
        let ok = unsafe {
            if protect {
                CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), UI_FORBIDDEN, &mut out)
            } else {
                CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), UI_FORBIDDEN, &mut out)
            }
        };
        if ok == 0 || out.pb.is_null() {
            return None;
        }
        let v = unsafe { std::slice::from_raw_parts(out.pb, out.cb as usize).to_vec() };
        unsafe { LocalFree(out.pb as *mut c_void) };
        Some(v)
    }
    pub fn protect(d: &[u8]) -> Option<Vec<u8>> { run(d, true) }
    pub fn unprotect(d: &[u8]) -> Option<Vec<u8>> { run(d, false) }
}

/// Chiffre un secret pour config.json ("dpapi:…" sous Windows ; "plain:…" ailleurs, pour les essais).
fn seal(secret: &str) -> String {
    #[cfg(windows)]
    {
        if let Some(e) = dpapi::protect(secret.as_bytes()) {
            return format!("dpapi:{}", b64(&e));
        }
    }
    format!("plain:{}", b64(secret.as_bytes()))
}

fn unseal(stored: &str) -> Option<String> {
    if let Some(rest) = stored.strip_prefix("plain:") {
        return String::from_utf8(unb64(rest)?).ok();
    }
    #[cfg(windows)]
    {
        if let Some(rest) = stored.strip_prefix("dpapi:") {
            return String::from_utf8(dpapi::unprotect(&unb64(rest)?)?).ok();
        }
    }
    None
}

/// Réglages pour l'extérieur : secrets remplacés par un masque.
fn masked(settings: &Map<String, Value>) -> Map<String, Value> {
    let mut s = settings.clone();
    for k in SECRET_KEYS {
        if let Some(x) = s.get_mut(k) {
            if x.as_str().map(|t| !t.is_empty()).unwrap_or(false) {
                *x = Value::String(MASK.to_string());
            }
        }
    }
    s
}

/// Nouveaux réglages d'une page : un secret renvoyé masqué garde l'ancien, un secret saisi est chiffré.
fn merge_settings(old: &Map<String, Value>, mut next: Map<String, Value>) -> Map<String, Value> {
    for k in SECRET_KEYS {
        match next.get(k).and_then(Value::as_str) {
            Some(MASK) => match old.get(k) {
                Some(o) => { next.insert(k.to_string(), o.clone()); }
                None => { next.remove(k); }
            },
            Some("") | None => {}
            // déjà chiffré : seul le compagnon écrit ces valeurs, on ne les accepte pas de l'extérieur
            Some(plain) if plain.starts_with("dpapi:") || plain.starts_with("plain:") => {
                match old.get(k) {
                    Some(o) => { next.insert(k.to_string(), o.clone()); }
                    None => { next.remove(k); }
                }
            }
            Some(plain) => { next.insert(k.to_string(), Value::String(seal(plain.trim()))); }
        }
    }
    next
}

fn page_json(p: &Page) -> Value {
    let name = modules().into_iter().find(|m| m.id == p.module).map(|m| m.name).unwrap_or("");
    json!({ "id": p.id, "module": p.module, "name": name, "settings": masked(&p.settings), "version": p.version })
}

/// Un Dot Hub pour l'extérieur : la page affichée (module, réglages masqués, version), son nom, « Identifier ».
fn instance_json(cfg: &Config, uid: &str, inst: &Instance) -> Value {
    let page = inst.page.as_ref().and_then(|id| cfg.pages.iter().find(|p| &p.id == id));
    json!({
        "name": inst.name,
        "page": page.map(|p| p.id.clone()),
        "module": page.map(|p| p.module.clone()),
        "settings": page.map(|p| masked(&p.settings)).unwrap_or_default(),
        "version": inst.version + page.map(|p| p.version).unwrap_or(0),
        "identify": inst.identify,
        "last_seen": inst.last_seen,
        "connected": connected(uid),
    })
}

fn read_json(req: &mut Request, limit: u64) -> Option<Value> {
    let mut body = String::new();
    req.as_reader().take(limit).read_to_string(&mut body).ok()?;
    serde_json::from_str(&body).ok()
}

fn query(url: &str, key: &str) -> String {
    url.split_once('?')
        .map(|(_, q)| q)
        .unwrap_or("")
        .split('&')
        .find_map(|kv| kv.split_once('=').filter(|(k, _)| *k == key).map(|(_, v)| percent_decode(v)))
        .unwrap_or_default()
}

fn cache_dir() -> PathBuf {
    config_path().parent().map(|p| p.join("cache").join("steam")).unwrap_or_else(|| PathBuf::from("cache"))
}

fn url_encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn main() {
    let addr = format!("127.0.0.1:{PORT}");
    // après une mise à jour, l'ancien compagnon libère le port un instant plus tard : on réessaie
    let updated = std::env::args().any(|a| a == "--updated");
    let mut tries = if updated { 30 } else { 4 };
    let server = loop {
        match Server::http(&addr) {
            Ok(s) => break s,
            Err(e) if tries == 0 => {
                let text = format!("Impossible d'écouter sur {addr} : {e}\nLe port {PORT} est peut-être déjà utilisé (Dot Companion déjà lancé ?).");
                eprintln!("{text}");
                #[cfg(any(windows, feature = "check-win"))]
                tray::message_box(&text);
                #[cfg(not(any(windows, feature = "check-win")))]
                pause();
                return;
            }
            Err(_) => {
                tries -= 1;
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        }
    };
    let mut c = load_config();
    if migrate(&mut c) {
        save_config(&c);
    }
    // première ouverture : Dot Companion démarrera avec Windows (désactivable dans les réglages et le menu de l'icône)
    if !c.startup_done && startup::supported() {
        startup::set(true);
        c.startup_done = true;
        save_config(&c);
    }
    let _ = CFG.set(Mutex::new(c));
    update::cleanup_old();
    update::start_background();
    println!("Dot Companion {VERSION} prêt sur http://{addr}/");
    println!("Réglages : http://{addr}/settings");
    println!("Configuration : {}", config_path().display());

    let serve = move || {
        for req in server.incoming_requests() {
            let mut g = cfg();
            handle(req, &mut g);
        }
    };
    // Windows : le serveur tourne à côté, l'icône de la zone de notification garde le fil principal
    #[cfg(any(windows, feature = "check-win"))]
    {
        std::thread::spawn(serve);
        tray::run();
    }
    #[cfg(not(any(windows, feature = "check-win")))]
    {
        println!("Ctrl+C arrête le compagnon.");
        serve();
    }
}

#[cfg(not(any(windows, feature = "check-win")))]
fn pause() {
    println!("Appuie sur Entrée pour fermer.");
    let mut s = String::new();
    let _ = std::io::stdin().read_line(&mut s);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reprise_avant_0_5() {
        let old = r#"{"instances":{"a":{"name":"gauche","module":"clock","settings":{"x":1}},"b":{"module":"clock","settings":{"x":1}},"c":{"module":"steam"},"d":{}}}"#;
        let mut c: Config = serde_json::from_str(old).unwrap();
        assert!(migrate(&mut c));
        assert_eq!(c.pages.len(), 2, "même module et mêmes réglages : une seule page");
        assert_eq!(c.instances["a"].page, c.instances["b"].page);
        assert_eq!(c.pages.iter().find(|p| Some(&p.id) == c.instances["c"].page.as_ref()).unwrap().module, "steam");
        assert!(c.instances["d"].page.is_none());
        assert!(!migrate(&mut c), "une seule fois");
        let v = serde_json::to_value(&c).unwrap();
        assert!(v["instances"]["a"].get("module").is_none() && v["instances"]["a"].get("settings").is_none(), "anciens champs plus écrits");
    }

    #[test]
    fn secrets() {
        let mut old = Map::new();
        old.insert("steamApiKey".into(), Value::String(seal("cle")));
        let mut next = Map::new();
        next.insert("steamApiKey".into(), Value::String(MASK.into()));
        assert_eq!(merge_settings(&old, next.clone()), old, "masque : on garde l'ancien");
        next.insert("steamApiKey".into(), Value::String("plain:Zm9v".into()));
        assert_eq!(merge_settings(&old, next.clone()), old, "valeur chiffrée venue de l'extérieur : refusée");
        next.insert("steamApiKey".into(), Value::String(" neuve ".into()));
        let m = merge_settings(&old, next);
        assert_eq!(unseal(m["steamApiKey"].as_str().unwrap()).as_deref(), Some("neuve"));
        assert_eq!(masked(&m)["steamApiKey"], MASK);
    }
}
