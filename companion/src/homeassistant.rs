//! Module Home Assistant (Dot Home Assistant) : la maison, par l'API REST de Home Assistant.
//!
//! - adresse (`http://homeassistant.local:8123`) et jeton d'accès longue durée (profil Home Assistant → Sécurité),
//!   le jeton chiffré dans la configuration du compagnon, jamais envoyé au module ;
//! - `GET /api/states` toutes les 2 s ; pièces et appareils (pour réunir température et humidité d'un même capteur)
//!   par `POST /api/template` et intégrations par `GET /api/config/config_entries/entry`, toutes les 60 s ;
//! - les commandes passent par `POST /api/services/<domaine>/<service>`, limitées à une liste (voir `allowed`) ;
//! - les requêtes passent par curl (fourni avec Windows), le jeton par l'entrée standard, jamais sur la ligne de commande ;
//! - un fil par Home Assistant, arrêté après 10 min sans que personne n'affiche la page.
//!
//! `state()` rend l'état attendu par le rendu du module (`widgets/dot-homeassistant/scripts/homeassistant.js`, voir `demo()`).

use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

const EVERY: Duration = Duration::from_secs(2);
const META_EVERY: Duration = Duration::from_secs(60);
const IDLE_STOP: Duration = Duration::from_secs(600);

/// Ce qu'on sait d'un Home Assistant.
#[derive(Default)]
struct Home {
    states: Vec<Value>,
    /// pièces : [{ id, name, e: [entity_id…] }] ; capteurs de température et d'humidité : [entity_id, device_id, nom]
    areas: Vec<Value>,
    devices: Vec<Value>,
    entries: Vec<Value>,
    error: Option<String>,
    ok_once: bool,
    used: Option<Instant>,
    running: bool,
    /// une commande vient de partir : relire tout de suite
    poke: bool,
}

type Shared = Arc<Mutex<Home>>;

fn homes() -> &'static Mutex<HashMap<String, Shared>> {
    static H: OnceLock<Mutex<HashMap<String, Shared>>> = OnceLock::new();
    H.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock(h: &Shared) -> std::sync::MutexGuard<'_, Home> {
    h.lock().unwrap_or_else(|e| e.into_inner())
}

/// Réglages d'une page : adresse de Home Assistant et jeton (déjà déchiffré).
pub struct Target {
    pub url: String,
    pub token: String,
}

impl Target {
    fn base(&self) -> String {
        let u = self.url.trim().trim_end_matches('/');
        if u.starts_with("http://") || u.starts_with("https://") {
            u.to_string()
        } else {
            format!("http://{u}")
        }
    }
    fn ready(&self) -> bool {
        !self.url.trim().is_empty() && !self.token.is_empty()
    }
    fn key(&self) -> String {
        format!("{}|{}", self.base(), self.token)
    }
}

/// Le Home Assistant d'une page, suivi au besoin (premier appel, ou fil arrêté).
fn home(t: &Target) -> Shared {
    let mut all = homes().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(h) = all.get(&t.key()) {
        let mut g = lock(h);
        g.used = Some(Instant::now());
        if g.running {
            return h.clone();
        }
        g.running = true;
        drop(g);
        let (base, token, shared) = (t.base(), t.token.clone(), h.clone());
        std::thread::spawn(move || run(&base, &token, shared));
        return h.clone();
    }
    let h: Shared = Arc::new(Mutex::new(Home { used: Some(Instant::now()), running: true, ..Default::default() }));
    all.insert(t.key(), h.clone());
    let (base, token, shared) = (t.base(), t.token.clone(), h.clone());
    std::thread::spawn(move || run(&base, &token, shared));
    h
}

/// Pièces de Home Assistant et capteurs de température / humidité avec leur appareil, en une requête de modèle.
const TEMPLATE: &str = "{%- set ns = namespace(a=[], d=[]) -%}\
{%- for a in areas() -%}{%- set ns.a = ns.a + [{'id': a, 'name': area_name(a), 'e': area_entities(a)}] -%}{%- endfor -%}\
{%- for s in states.sensor -%}{%- if s.attributes.device_class in ['temperature', 'humidity'] -%}\
{%- set d = device_id(s.entity_id) -%}{%- if d -%}\
{%- set ns.d = ns.d + [[s.entity_id, d, device_attr(d, 'name_by_user') or device_attr(d, 'name') or '']] -%}\
{%- endif -%}{%- endif -%}{%- endfor -%}\
{{ {'areas': ns.a, 'dev': ns.d} | tojson }}";

/// Le fil d'un Home Assistant : états toutes les 2 s, pièces et intégrations toutes les 60 s.
fn run(base: &str, token: &str, h: Shared) {
    let mut meta_at: Option<Instant> = None;
    loop {
        {
            let mut g = lock(&h);
            if g.used.map(|u| u.elapsed() > IDLE_STOP).unwrap_or(true) {
                g.running = false;
                return;
            }
            g.poke = false;
        }
        match get(base, token, "/api/states") {
            Ok(Value::Array(list)) => {
                let mut g = lock(&h);
                g.states = list;
                g.error = None;
                g.ok_once = true;
            }
            Ok(_) => lock(&h).error = Some("Unexpected answer from Home Assistant".into()),
            Err(e) => lock(&h).error = Some(e),
        }
        if lock(&h).error.is_none() && meta_at.map(|m| m.elapsed() > META_EVERY).unwrap_or(true) {
            meta_at = Some(Instant::now());
            if let Ok((200, body)) = curl(base, token, "POST", "/api/template", Some(&json!({ "template": TEMPLATE }).to_string()), 10) {
                if let Ok(v) = serde_json::from_slice::<Value>(&body) {
                    let mut g = lock(&h);
                    g.areas = v.get("areas").and_then(Value::as_array).cloned().unwrap_or_default();
                    g.devices = v.get("dev").and_then(Value::as_array).cloned().unwrap_or_default();
                }
            }
            if let Ok(Value::Array(list)) = get(base, token, "/api/config/config_entries/entry") {
                lock(&h).entries = list;
            }
        }
        // attente de 2 s, écourtée par une commande
        let t0 = Instant::now();
        while t0.elapsed() < EVERY {
            std::thread::sleep(Duration::from_millis(100));
            if lock(&h).poke {
                break;
            }
        }
    }
}

fn get(base: &str, token: &str, path: &str) -> Result<Value, String> {
    match curl(base, token, "GET", path, None, 8) {
        Ok((200, body)) => serde_json::from_slice(&body).map_err(|_| "Unexpected answer from Home Assistant".to_string()),
        Ok((401, _)) | Ok((403, _)) => Err("Wrong token · check it in Dot Companion".into()),
        Ok((404, _)) => Err("Home Assistant API not found · check the URL in Dot Companion".into()),
        Ok((code, _)) => Err(format!("Home Assistant answered {code}")),
        Err(e) => Err(e),
    }
}

/// Texte d'une valeur de configuration de curl, entre guillemets (\ et " échappés).
fn quoted(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    o.push('"');
    for c in s.chars() {
        match c {
            '\\' => o.push_str("\\\\"),
            '"' => o.push_str("\\\""),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            _ => o.push(c),
        }
    }
    o.push('"');
    o
}

/// Configuration de curl pour une requête : adresse, méthode, jeton, corps (tout passe par l'entrée standard).
fn curl_config(base: &str, token: &str, method: &str, path: &str, body: Option<&str>) -> String {
    let mut c = format!("url = {}\nrequest = {}\nheader = {}\n", quoted(&format!("{base}{path}")), quoted(method), quoted(&format!("Authorization: Bearer {token}")));
    if let Some(b) = body {
        c.push_str(&format!("header = {}\ndata-binary = {}\n", quoted("Content-Type: application/json"), quoted(b)));
    }
    c.push_str("write-out = \"\\n%{http_code}\"\n");
    c
}

/// Requête vers Home Assistant : (code HTTP, corps).
fn curl(base: &str, token: &str, method: &str, path: &str, body: Option<&str>, secs: u32) -> Result<(u16, Vec<u8>), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let mut cmd = Command::new("curl");
    let secs = secs.to_string();
    cmd.args(["-s", "-m", &secs, "-K", "-"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let mut child = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|_| "curl not found".to_string())?;
    child.stdin.take().ok_or("curl")?.write_all(curl_config(base, token, method, path, body).as_bytes()).map_err(|_| "curl".to_string())?;
    let o = child.wait_with_output().map_err(|_| "curl".to_string())?;
    split_code(&o.stdout).filter(|(c, _)| *c > 0).ok_or_else(|| "Home Assistant unreachable · check the URL in Dot Companion".to_string())
}

/// Sortie de curl : le corps, puis le code HTTP sur la dernière ligne (write-out).
fn split_code(out: &[u8]) -> Option<(u16, Vec<u8>)> {
    let nl = out.iter().rposition(|&b| b == b'\n')?;
    let code = std::str::from_utf8(&out[nl + 1..]).ok()?.trim().parse().ok()?;
    Some((code, out[..nl].to_vec()))
}

// ---------------------------------------------------------------- état pour le module

/// État d'une page, tout de suite (le fil met à jour en arrière-plan).
pub fn state(t: &Target) -> Value {
    if !t.ready() {
        return json!({ "state": "offline", "hint": "Set URL and token in Dot Companion" });
    }
    let h = home(t);
    let g = lock(&h);
    if let Some(e) = &g.error {
        return json!({ "state": "offline", "hint": e });
    }
    if !g.ok_once {
        return json!({ "state": "offline", "hint": "Connecting to Home Assistant…" });
    }
    build(&g.states, &g.areas, &g.devices, &g.entries)
}

fn attr<'a>(s: &'a Value, k: &str) -> Option<&'a Value> {
    s.get("attributes").and_then(|a| a.get(k))
}
fn attr_f(s: &Value, k: &str) -> Option<f64> {
    attr(s, k).and_then(Value::as_f64)
}
fn name_of(s: &Value) -> String {
    attr(s, "friendly_name").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| s["entity_id"].as_str().unwrap_or("").to_string())
}
fn hex(rgb: &Value) -> Option<String> {
    let a = rgb.as_array()?;
    let c = |i: usize| a.get(i).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 255.0) as u8;
    Some(format!("#{:02x}{:02x}{:02x}", c(0), c(1), c(2)))
}
/// 1 décimale au plus
fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// États bruts de Home Assistant → entités, pièces, mises à jour et intégrations du module.
pub fn build(states: &[Value], areas: &[Value], devices: &[Value], entries: &[Value]) -> Value {
    let by_id: HashMap<&str, &Value> = states.iter().filter_map(|s| Some((s["entity_id"].as_str()?, s))).collect();
    let mut area_of: HashMap<String, String> = HashMap::new();
    let mut area_list = vec![];
    for a in areas {
        let id = a["id"].as_str().unwrap_or("").to_string();
        for e in a["e"].as_array().into_iter().flatten().filter_map(Value::as_str) {
            area_of.entry(e.to_string()).or_insert_with(|| id.clone());
        }
        area_list.push(json!({ "id": id, "name": a["name"].as_str().unwrap_or("") }));
    }
    let area = |id: &str| area_of.get(id).cloned().unwrap_or_default();

    // capteurs de température et d'humidité d'un même appareil : une seule carte
    let mut th: Vec<(String, String, Option<String>, Option<String>)> = vec![]; // (appareil, nom, température, humidité)
    for d in devices {
        let (Some(eid), Some(dev)) = (d[0].as_str(), d[1].as_str()) else { continue };
        let Some(s) = by_id.get(eid) else { continue };
        let class = attr(s, "device_class").and_then(Value::as_str).unwrap_or("");
        let i = match th.iter().position(|x| x.0 == dev) {
            Some(i) => i,
            None => {
                th.push((dev.to_string(), d[2].as_str().unwrap_or("").to_string(), None, None));
                th.len() - 1
            }
        };
        if class == "temperature" && th[i].2.is_none() {
            th[i].2 = Some(eid.to_string());
        } else if class == "humidity" && th[i].3.is_none() {
            th[i].3 = Some(eid.to_string());
        }
    }

    let mut out = vec![];
    for (dev, dname, t, hm) in &th {
        let Some(t) = t else { continue };
        let num = |id: &Option<String>| id.as_ref().and_then(|i| by_id.get(i.as_str())).and_then(|s| s["state"].as_str()).and_then(|x| x.parse::<f64>().ok());
        let ts = by_id[t.as_str()];
        let name = if dname.is_empty() { name_of(ts) } else { dname.clone() };
        out.push(json!({ "id": format!("th:{dev}"), "type": "th", "name": name, "area": area(t), "temp": num(&Some(t.clone())).map(round1), "hum": num(hm).map(f64::round), "tempUnit": attr(ts, "unit_of_measurement").and_then(Value::as_str).unwrap_or("°C") }));
    }

    let mut updates = vec![];
    for s in states {
        let id = s["entity_id"].as_str().unwrap_or("");
        let st = s["state"].as_str().unwrap_or("");
        let (domain, _) = id.split_once('.').unwrap_or(("", ""));
        let na = st == "unavailable" || st == "unknown";
        let mut e = json!({ "id": id, "name": name_of(s), "area": area(id) });
        if na {
            e["na"] = json!(true);
        }
        match domain {
            "light" => {
                e["type"] = json!("light");
                e["on"] = json!(st == "on");
                e["lvl"] = json!(attr_f(s, "brightness").map(|b| (b / 255.0 * 100.0).round() / 100.0).unwrap_or(if st == "on" { 1.0 } else { 0.0 }));
                let modes: Vec<&str> = attr(s, "supported_color_modes").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
                e["color"] = json!(modes.iter().any(|m| ["hs", "rgb", "rgbw", "rgbww", "xy"].contains(m)));
                e["white"] = json!(modes.contains(&"color_temp"));
                if let Some(c) = attr(s, "rgb_color").and_then(hex) {
                    e["rgb"] = json!(c);
                }
                if let Some(k) = attr_f(s, "color_temp_kelvin") {
                    e["kelvin"] = json!(k.round());
                }
                e["mode"] = json!(if attr(s, "color_mode").and_then(Value::as_str) == Some("color_temp") { "white" } else { "color" });
                if let Some(m) = attr(s, "entity_id").and_then(Value::as_array) {
                    let on = m.iter().filter_map(Value::as_str).filter(|x| by_id.get(x).and_then(|s| s["state"].as_str()) == Some("on")).count();
                    e["members"] = json!(m.len());
                    e["membersOn"] = json!(on);
                }
            }
            "switch" | "input_boolean" | "fan" => {
                e["type"] = json!("plug");
                e["on"] = json!(st == "on");
            }
            "cover" => {
                e["type"] = json!("cover");
                e["lvl"] = json!(attr_f(s, "current_position").map(|p| p / 100.0).unwrap_or(if st == "open" { 1.0 } else { 0.0 }));
                e["moving"] = json!(st == "opening" || st == "closing");
            }
            "climate" => {
                e["type"] = json!("climate");
                e["cur"] = json!(attr_f(s, "current_temperature").map(round1));
                e["target"] = json!(attr_f(s, "temperature").map(round1));
                e["action"] = json!(attr(s, "hvac_action").and_then(Value::as_str).unwrap_or(st));
                e["min"] = json!(attr_f(s, "min_temp").unwrap_or(7.0));
                e["max"] = json!(attr_f(s, "max_temp").unwrap_or(35.0));
                e["step"] = json!(attr_f(s, "target_temp_step").unwrap_or(0.5));
            }
            "lock" => {
                e["type"] = json!("lock");
                e["on"] = json!(st == "locked");
            }
            "scene" | "script" => e["type"] = json!("scene"),
            "automation" => {
                e["type"] = json!("auto");
                e["on"] = json!(st == "on");
                e["last"] = attr(s, "last_triggered").cloned().unwrap_or(Value::Null);
            }
            "sensor" => {
                let unit = attr(s, "unit_of_measurement").and_then(Value::as_str).unwrap_or("");
                let class = attr(s, "device_class").and_then(Value::as_str).unwrap_or("");
                e["unit"] = json!(unit);
                e["dc"] = json!(class);
                match st.parse::<f64>() {
                    Ok(v) => {
                        e["type"] = json!(if class == "power" { "power" } else { "sensor" });
                        e["value"] = json!(if v.abs() >= 100.0 { v.round() } else { round1(v) });
                    }
                    Err(_) => {
                        e["type"] = json!("state");
                        e["value"] = json!(st);
                    }
                }
            }
            "binary_sensor" => {
                e["type"] = json!("binary");
                e["on"] = json!(st == "on");
                e["dc"] = json!(attr(s, "device_class").and_then(Value::as_str).unwrap_or(""));
            }
            "update" => {
                if st == "on" {
                    let title = attr(s, "title").and_then(Value::as_str).filter(|t| !t.is_empty()).map(str::to_string).unwrap_or_else(|| name_of(s));
                    updates.push(json!({ "id": id, "name": title, "ver": attr(s, "latest_version").cloned().unwrap_or(Value::Null), "installing": attr(s, "in_progress").map(|v| v.as_bool().unwrap_or(true)).unwrap_or(false) }));
                }
                continue;
            }
            // ce qui n'a rien à montrer sur une carte
            "zone" | "persistent_notification" | "tts" | "stt" | "conversation" | "wake_word" | "event" | "image" | "camera" | "tag" | "todo" | "notify" | "ai_task" | "assist_satellite" | "" => continue,
            // le reste (personne, météo, lecteur, sélection…) : son état, en texte
            _ => {
                e["type"] = json!("state");
                e["value"] = json!(st);
                e["unit"] = json!(attr(s, "unit_of_measurement").and_then(Value::as_str).unwrap_or(""));
                e["dc"] = json!(attr(s, "device_class").and_then(Value::as_str).unwrap_or(""));
            }
        }
        out.push(e);
    }
    out.sort_by(|a, b| a["name"].as_str().unwrap_or("").to_lowercase().cmp(&b["name"].as_str().unwrap_or("").to_lowercase()));

    // intégrations : erreurs d'abord
    let mut services: Vec<Value> = entries
        .iter()
        .filter(|x| x["disabled_by"].is_null())
        .map(|x| {
            let st = match x["state"].as_str().unwrap_or("") {
                "loaded" => "ok",
                "not_loaded" => "stop",
                _ => "err",
            };
            json!({ "name": x["title"].as_str().filter(|t| !t.is_empty()).or(x["domain"].as_str()).unwrap_or(""), "st": st })
        })
        .collect();
    services.sort_by_key(|x| match x["st"].as_str() {
        Some("err") => 0,
        Some("stop") => 1,
        _ => 2,
    });

    json!({ "state": "online", "areas": area_list, "entities": out, "updates": updates, "services": services })
}

// ---------------------------------------------------------------- commandes

/// Services que le module peut appeler.
fn allowed(domain: &str, service: &str) -> bool {
    matches!(
        (domain, service),
        ("light", "turn_on" | "turn_off" | "toggle")
            | ("switch" | "input_boolean" | "fan", "turn_on" | "turn_off" | "toggle")
            | ("cover", "open_cover" | "close_cover" | "stop_cover" | "set_cover_position")
            | ("climate", "set_temperature")
            | ("lock", "lock" | "unlock")
            | ("scene" | "script", "turn_on")
            | ("automation", "trigger")
            | ("update", "install")
    )
}

/// Appel d'un service : `{ "domain", "service", "entity", "data" }` ; l'entité doit exister et appartenir au domaine.
pub fn call(t: &Target, body: &Value) -> bool {
    let (Some(domain), Some(service), Some(entity)) = (body["domain"].as_str(), body["service"].as_str(), body["entity"].as_str()) else { return false };
    let (edom, _) = entity.split_once('.').unwrap_or(("", ""));
    if !t.ready() || !allowed(domain, service) || edom != domain {
        return false;
    }
    let h = home(t);
    if !lock(&h).states.iter().any(|s| s["entity_id"].as_str() == Some(entity)) {
        return false;
    }
    // seules quelques clés passent, avec des valeurs numériques ou des couleurs
    let mut data = Map::new();
    data.insert("entity_id".into(), json!(entity));
    if let Some(Value::Object(d)) = body.get("data") {
        for k in ["brightness_pct", "color_temp_kelvin", "temperature", "position"] {
            if let Some(v) = d.get(k).and_then(Value::as_f64) {
                data.insert(k.into(), json!(v));
            }
        }
        if let Some(rgb) = d.get("rgb_color").and_then(Value::as_array) {
            if rgb.len() == 3 && rgb.iter().all(|x| x.as_f64().map(|v| (0.0..=255.0).contains(&v)).unwrap_or(false)) {
                data.insert("rgb_color".into(), json!(rgb));
            }
        }
    }
    let (base, token) = (t.base(), t.token.clone());
    let path = format!("/api/services/{domain}/{service}");
    let ok = matches!(curl(&base, &token, "POST", &path, Some(&Value::Object(data).to_string()), 10), Ok((200, _)));
    lock(&h).poke = true;
    ok
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(id: &str, st: &str, attrs: Value) -> Value {
        json!({ "entity_id": id, "state": st, "attributes": attrs })
    }

    #[test]
    fn etats() {
        let states = vec![
            s("light.ceiling", "on", json!({ "friendly_name": "Ceiling", "brightness": 204, "supported_color_modes": ["color_temp", "hs"], "color_mode": "hs", "rgb_color": [255, 179, 92] })),
            s("light.living", "on", json!({ "friendly_name": "Living room", "entity_id": ["light.ceiling", "light.floor"] })),
            s("light.floor", "off", json!({ "friendly_name": "Floor lamp" })),
            s("sensor.bed_t", "19.84", json!({ "device_class": "temperature", "unit_of_measurement": "°C", "friendly_name": "Bed T" })),
            s("sensor.bed_h", "52.4", json!({ "device_class": "humidity", "unit_of_measurement": "%" })),
            s("sensor.power", "412.3", json!({ "device_class": "power", "unit_of_measurement": "W", "friendly_name": "Power" })),
            s("sensor.text", "hello", json!({})),
            s("climate.living", "heat", json!({ "friendly_name": "Thermostat", "current_temperature": 21.44, "temperature": 22, "hvac_action": "heating" })),
            s("lock.front", "locked", json!({ "friendly_name": "Front door" })),
            s("update.core", "on", json!({ "title": "Home Assistant Core", "latest_version": "2026.11.0", "in_progress": false })),
            s("update.os", "off", json!({ "title": "Home Assistant OS" })),
            s("switch.tv", "unavailable", json!({ "friendly_name": "TV" })),
            s("binary_sensor.door", "on", json!({ "device_class": "door", "friendly_name": "Door" })),
            s("person.alex", "home", json!({ "friendly_name": "Alex" })),
            s("zone.home", "0", json!({ "friendly_name": "Home" })),
        ];
        let areas = vec![json!({ "id": "living", "name": "Living room", "e": ["light.ceiling", "climate.living"] })];
        let devices = vec![json!(["sensor.bed_t", "dev1", "Bedroom sensor"]), json!(["sensor.bed_h", "dev1", "Bedroom sensor"])];
        let entries = vec![json!({ "title": "Hue", "state": "loaded", "disabled_by": null }), json!({ "title": "Frigate", "state": "setup_error", "disabled_by": null }), json!({ "title": "Old", "state": "loaded", "disabled_by": "user" })];
        let v = build(&states, &areas, &devices, &entries);
        let e = |id: &str| v["entities"].as_array().unwrap().iter().find(|x| x["id"] == id).cloned().unwrap_or(Value::Null);
        assert_eq!(e("light.ceiling")["lvl"], json!(0.8));
        assert_eq!(e("light.ceiling")["rgb"], json!("#ffb35c"));
        assert_eq!(e("light.ceiling")["area"], json!("living"));
        assert_eq!(e("light.living")["membersOn"], json!(1));
        assert_eq!(e("th:dev1")["temp"], json!(19.8));
        assert_eq!(e("th:dev1")["hum"], json!(52.0));
        assert_eq!(e("th:dev1")["name"], json!("Bedroom sensor"));
        // chaque capteur reste aussi proposé seul (formulaire d'une carte)
        assert_eq!(e("sensor.bed_t")["dc"], json!("temperature"));
        assert_eq!(e("sensor.power")["type"], json!("power"));
        assert_eq!(e("sensor.text")["type"], json!("state"));
        assert_eq!(e("sensor.text")["value"], json!("hello"));
        assert_eq!(e("binary_sensor.door")["on"], json!(true));
        assert_eq!(e("binary_sensor.door")["dc"], json!("door"));
        assert_eq!(e("person.alex")["value"], json!("home"));
        assert!(e("zone.home").is_null());
        assert_eq!(e("climate.living")["cur"], json!(21.4));
        assert_eq!(e("lock.front")["on"], json!(true));
        assert_eq!(e("switch.tv")["na"], json!(true));
        assert_eq!(v["updates"].as_array().unwrap().len(), 1);
        assert_eq!(v["services"].as_array().unwrap().len(), 2);
        assert_eq!(v["services"][0]["st"], json!("err"));
    }

    #[test]
    fn securite() {
        assert!(allowed("light", "turn_on"));
        assert!(!allowed("homeassistant", "restart"));
        assert!(!allowed("shell_command", "turn_on"));
        // le jeton et le corps passent par la configuration de curl, échappés
        let c = curl_config("http://ha:8123", "abc\"def", "POST", "/api/x", Some("{\"a\":\"b\\\\c\"}"));
        assert!(c.contains("header = \"Authorization: Bearer abc\\\"def\""));
        assert!(c.contains("data-binary = \"{\\\"a\\\":\\\"b\\\\\\\\c\\\"}\""));
        assert_eq!(split_code(b"{\"ok\":1}\n200"), Some((200, b"{\"ok\":1}".to_vec())));
        assert_eq!(split_code(b"\n000").map(|x| x.0), Some(0));
        assert_eq!(Target { url: "homeassistant.local:8123/".into(), token: "t".into() }.base(), "http://homeassistant.local:8123");
    }
}
