//! Dot Companion : programme Windows qui sert Dot Hub.
//!
//! - écoute uniquement sur 127.0.0.1 (port 47800) ;
//! - sert l'accueil Dot Hub, la page de réglages et les modules (pour l'instant : Clock) ;
//! - ouvre la page de réglages dans le navigateur du PC quand on touche SETTINGS sur l'Edge ;
//! - module Steam (Dot Steam) : jeux, téléchargements, jeu en cours, amis, lancement (voir `steam.rs`) ;
//! - garde les secrets des modules (clés d'API) chiffrés avec DPAPI sous Windows ;
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

mod steam;

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
            "instances" => {
                let m: Map<String, Value> = cfg.instances.iter().map(|(k, i)| (k.clone(), masked(i))).collect();
                send_json(req, 200, &Value::Object(m))
            }
            // Dot Steam : état de Steam pour une instance (ses réglages : jeux choisis, clé d'API des amis)
            "steam" if seg(2) == "state" => {
                let uid = query(&url, "uid");
                let settings = cfg.instances.get(&uid).map(|i| i.settings.clone()).unwrap_or_default();
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
            "startup" => send_json(req, 200, &json!({ "supported": startup::supported(), "enabled": startup::enabled() })),
            "theme" => send_json(req, 200, &json!({ "theme": theme_full(cfg), "version": cfg.theme_version, "defaults": THEME_DEFAULTS.iter().map(|(k, v)| (k.to_string(), Value::String(v.to_string()))).collect::<Map<String, Value>>() })),
            "instance" => match cfg.instances.get(seg(2)) {
                Some(inst) => {
                    let mut v = masked(inst);
                    v["theme"] = Value::Object(theme_full(cfg));
                    v["theme_version"] = json!(cfg.theme_version);
                    send_json(req, 200, &v)
                }
                None => send_json(req, 404, &json!({ "error": "unknown instance" })),
            },
            _ => not_found(req),
        },

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
                let mut next = s.clone();
                for k in SECRET_KEYS {
                    match next.get(k).and_then(Value::as_str) {
                        // masque renvoyé tel quel par la page de réglages : on garde le secret déjà enregistré
                        Some(MASK) => match inst.settings.get(k) {
                            Some(old) => { next.insert(k.to_string(), old.clone()); }
                            None => { next.remove(k); }
                        },
                        Some("") | None => {}
                        Some(plain) if plain.starts_with("dpapi:") || plain.starts_with("plain:") => {}
                        Some(plain) => { next.insert(k.to_string(), Value::String(seal(plain.trim()))); }
                    }
                }
                inst.settings = next;
            }
            inst.version += 1;
            let out = masked(inst);
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

/// Copie d'une instance pour l'extérieur : secrets remplacés par un masque.
fn masked(inst: &Instance) -> Value {
    let mut v = serde_json::to_value(inst).unwrap_or(Value::Null);
    if let Some(Value::Object(s)) = v.get_mut("settings") {
        for k in SECRET_KEYS {
            if let Some(x) = s.get_mut(k) {
                if x.as_str().map(|t| !t.is_empty()).unwrap_or(false) {
                    *x = Value::String(MASK.to_string());
                }
            }
        }
    }
    v
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
    // première ouverture : Dot Companion démarrera avec Windows (désactivable dans la page de réglages)
    if !cfg.startup_done && startup::supported() {
        startup::set(true);
        cfg.startup_done = true;
        save_config(&cfg);
    }
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
