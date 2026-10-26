//! Dot Companion : programme Windows qui sert Dot Hub.
//!
//! - écoute uniquement sur 127.0.0.1 (port 47800) ;
//! - sert l'accueil Dot Hub, la page de réglages et les modules (pour l'instant : Clock) ;
//! - ouvre la page de réglages dans le navigateur du PC quand on touche SETTINGS sur l'Edge ;
//! - garde la configuration de chaque instance de Dot Hub (clé = `uniqueId` iCUE)
//!   dans `%APPDATA%\Xeneon\config.json`.

use include_dir::{include_dir, Dir};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const PORT: u16 = 47800;
const VERSION: &str = env!("CARGO_PKG_VERSION");

static WEB: Dir = include_dir!("$CARGO_MANIFEST_DIR/web");
static CLOCK: Dir = include_dir!("$CARGO_MANIFEST_DIR/../widgets/dot-clock");

struct Module {
    id: &'static str,
    name: &'static str,
    files: &'static Dir<'static>,
}

fn modules() -> Vec<Module> {
    vec![Module { id: "clock", name: "Dot Clock", files: &CLOCK }]
}

// ---------------------------------------------------------------- configuration

#[derive(Serialize, Deserialize, Default)]
struct Config {
    #[serde(default)]
    instances: BTreeMap<String, Instance>,
    /// couleurs communes à tous les modules (page de réglages, carte « Couleurs »)
    #[serde(default)]
    theme: Map<String, Value>,
    #[serde(default)]
    theme_version: u64,
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

#[derive(Serialize, Deserialize, Default, Clone)]
struct Instance {
    #[serde(default)]
    name: String,
    #[serde(default)]
    module: Option<String>,
    #[serde(default)]
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

        // point d'entrée de la coquille : /i/<uniqueId> → le module de l'instance, ou l'accueil
        (Method::Get, "i") => {
            let uid = seg(1).to_string();
            if uid.is_empty() {
                return not_found(req);
            }
            let inst = cfg.instances.entry(uid.clone()).or_default();
            inst.last_seen = now_ms();
            let module = inst.module.clone().filter(|m| modules().iter().any(|x| x.id == m));
            save_config(cfg);
            let q = format!("uid={}", url_encode(&uid));
            match module {
                Some(m) => redirect(req, &format!("/m/{m}/?{q}")),
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
            "instances" => send_json(req, 200, &serde_json::to_value(&cfg.instances).unwrap_or(Value::Null)),
            "theme" => send_json(req, 200, &json!({ "theme": theme_full(cfg), "version": cfg.theme_version, "defaults": THEME_DEFAULTS.iter().map(|(k, v)| (k.to_string(), Value::String(v.to_string()))).collect::<Map<String, Value>>() })),
            "instance" => match cfg.instances.get(seg(2)) {
                Some(inst) => {
                    let mut v = serde_json::to_value(inst).unwrap_or(Value::Null);
                    v["theme"] = Value::Object(theme_full(cfg));
                    v["theme_version"] = json!(cfg.theme_version);
                    send_json(req, 200, &v)
                }
                None => send_json(req, 404, &json!({ "error": "unknown instance" })),
            },
            _ => not_found(req),
        },

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

        (Method::Put, "api") if seg(1) == "instance" => {
            let uid = seg(2).to_string();
            let mut body = String::new();
            let _ = req.as_reader().take(1 << 20).read_to_string(&mut body);
            let patch: Value = match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(_) => return send_json(req, 400, &json!({ "error": "invalid JSON" })),
            };
            let inst = cfg.instances.entry(uid).or_default();
            if let Some(m) = patch.get("module") {
                inst.module = m.as_str().map(str::to_string);
            }
            if let Some(n) = patch.get("name").and_then(Value::as_str) {
                inst.name = n.chars().take(40).collect();
            }
            if let Some(Value::Object(s)) = patch.get("settings") {
                inst.settings = s.clone();
            }
            inst.version += 1;
            let out = serde_json::to_value(&*inst).unwrap_or(Value::Null);
            save_config(cfg);
            send_json(req, 200, &out)
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
    let url = format!("http://127.0.0.1:{PORT}/settings");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .is_ok()
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open").arg(&url).spawn().is_ok()
    }
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
    let server = match Server::http(&addr) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Impossible d'écouter sur {addr} : {e}");
            eprintln!("Le port {PORT} est peut-être déjà utilisé (Dot Companion déjà lancé ?).");
            pause();
            return;
        }
    };
    let mut cfg = load_config();
    println!("Dot Companion {VERSION} prêt sur http://{addr}/");
    println!("Réglages : http://{addr}/settings");
    println!("Configuration : {}", config_path().display());
    println!("Fermer cette fenêtre arrête le compagnon.");
    for req in server.incoming_requests() {
        handle(req, &mut cfg);
    }
}

fn pause() {
    println!("Appuie sur Entrée pour fermer.");
    let mut s = String::new();
    let _ = std::io::stdin().read_line(&mut s);
}
