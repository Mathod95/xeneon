//! Module Bambu Lab (Dot Bambu Lab) : une imprimante 3D Bambu Lab en réseau local.
//!
//! - MQTT sur TLS (port 8883), utilisateur `bblp`, mot de passe = code d'accès LAN de l'imprimante ; le certificat de
//!   l'imprimante (signé par Bambu Lab) est accepté tel quel : on ne parle qu'à l'adresse IP réglée, en réseau local ;
//! - abonnement à `device/<numéro de série>/report`, demande `pushall` à la connexion puis toutes les 5 min
//!   (le P1S n'envoie ensuite que ce qui change : l'état est cumulé) ;
//! - commandes sur `device/<numéro de série>/request` : lampe, pause, reprise, arrêt ;
//! - une connexion par imprimante, dans son propre fil, qui se reconnecte seule et s'arrête après 10 min
//!   sans que personne n'affiche l'imprimante.
//!
//! `state()` rend l'état attendu par le rendu du module (`widgets/dot-bambulab/scripts/bambulab.js`, voir `demo()`).

use rumqttc::{Client, Event, Incoming, MqttOptions, QoS, TlsConfiguration, Transport};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const PORT: u16 = 8883;
const PUSHALL_EVERY: Duration = Duration::from_secs(300);
const IDLE_STOP: Duration = Duration::from_secs(600);
/// au-delà, sans aucun message de l'imprimante, elle est considérée hors ligne
const SILENT: Duration = Duration::from_secs(90);

/// Ce qu'on sait d'une imprimante.
#[derive(Default)]
struct Printer {
    /// objet `print` des rapports, cumulé (chaque rapport ne contient que ce qui a changé)
    print: Map<String, Value>,
    connected: bool,
    error: Option<String>,
    last_message: Option<Instant>,
    /// dernière demande d'état (le fil s'arrête quand plus personne ne regarde)
    used: Option<Instant>,
    client: Option<Client>,
    /// dernière impression terminée : nom et heure (ms)
    last_finished: Option<(String, u64)>,
}

type Shared = Arc<Mutex<Printer>>;

fn printers() -> &'static Mutex<HashMap<String, Shared>> {
    static P: OnceLock<Mutex<HashMap<String, Shared>>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock(p: &Shared) -> std::sync::MutexGuard<'_, Printer> {
    p.lock().unwrap_or_else(|e| e.into_inner())
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Réglages d'une page : adresse IP, numéro de série, code d'accès (déjà déchiffré).
pub struct Target {
    pub ip: String,
    pub serial: String,
    pub code: String,
}

impl Target {
    fn ready(&self) -> bool {
        !self.ip.is_empty() && !self.serial.is_empty() && !self.code.is_empty()
    }
    fn key(&self) -> String {
        format!("{}|{}|{}", self.ip, self.serial, self.code)
    }
}

/// L'imprimante d'une page, connectée au besoin (premier appel, ou fil arrêté).
fn printer(t: &Target) -> Shared {
    let mut all = printers().lock().unwrap_or_else(|e| e.into_inner());
    // une seule connexion par numéro de série : d'anciens réglages (autre IP, autre code) sont oubliés
    all.retain(|k, _| !k.contains(&format!("|{}|", t.serial)) || *k == t.key());
    if let Some(p) = all.get(&t.key()) {
        let mut g = lock(p);
        g.used = Some(Instant::now());
        if g.client.is_some() {
            return p.clone();
        }
    }
    let p: Shared = Arc::new(Mutex::new(Printer { used: Some(Instant::now()), ..Default::default() }));
    all.insert(t.key(), p.clone());
    let (ip, serial, code, shared) = (t.ip.clone(), t.serial.clone(), t.code.clone(), p.clone());
    std::thread::spawn(move || run(&ip, &serial, &code, shared));
    p
}

/// TLS : certificat de l'imprimante accepté tel quel (signé par Bambu Lab, pas par une autorité publique). Les signatures
/// de l'échange ne sont pas vérifiées non plus : elles ne prouveraient rien de plus sur un certificat qu'on ne vérifie pas,
/// et leur lecture peut échouer sur le format du certificat de l'imprimante.
#[derive(Debug)]
struct PrinterCert(Arc<rustls::crypto::CryptoProvider>);

impl ServerCertVerifier for PrinterCert {
    fn verify_server_cert(&self, _: &CertificateDer<'_>, _: &[CertificateDer<'_>], _: &ServerName<'_>, _: &[u8], _: UnixTime) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(&self, _: &[u8], _: &CertificateDer<'_>, _: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }
    fn verify_tls13_signature(&self, _: &[u8], _: &CertificateDer<'_>, _: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

fn tls() -> Option<Arc<rustls::ClientConfig>> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let cfg = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions()
        .ok()?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(PrinterCert(provider)))
        .with_no_client_auth();
    Some(Arc::new(cfg))
}

fn request(client: &Client, serial: &str, body: Value) -> bool {
    client.try_publish(format!("device/{serial}/request"), QoS::AtMostOnce, false, body.to_string()).is_ok()
}

fn pushall(client: &Client, serial: &str) -> bool {
    request(client, serial, json!({ "pushing": { "sequence_id": "0", "command": "pushall" } }))
}

/// Le fil d'une imprimante : connexion, rapports, reconnexion, arrêt quand plus personne ne regarde.
fn run(ip: &str, serial: &str, code: &str, p: Shared) {
    let Some(cfg) = tls() else {
        lock(&p).error = Some("TLS unavailable".into());
        return;
    };
    let mut opts = MqttOptions::new(format!("dot-companion-{}", now_ms() % 100000), ip, PORT);
    opts.set_credentials("bblp", code);
    opts.set_keep_alive(Duration::from_secs(30));
    opts.set_max_packet_size(1 << 20, 1 << 20);
    opts.set_transport(Transport::tls_with_config(TlsConfiguration::Rustls(cfg)));
    let (client, mut conn) = Client::new(opts, 16);
    lock(&p).client = Some(client.clone());
    let topic = format!("device/{serial}/report");
    let mut last_push = Instant::now();

    for ev in conn.iter() {
        // plus personne ne regarde : on s'arrête (la prochaine demande d'état relance une connexion)
        let unused = lock(&p).used.map(|u| u.elapsed() > IDLE_STOP).unwrap_or(true);
        if unused {
            let _ = client.disconnect();
            break;
        }
        match ev {
            Ok(Event::Incoming(Incoming::ConnAck(_))) => {
                {
                    let mut g = lock(&p);
                    g.connected = true;
                    g.error = None;
                }
                let _ = client.try_subscribe(topic.as_str(), QoS::AtMostOnce);
                pushall(&client, serial);
                last_push = Instant::now();
            }
            Ok(Event::Incoming(Incoming::Publish(msg))) => {
                if let Ok(Value::Object(report)) = serde_json::from_slice::<Value>(&msg.payload) {
                    merge_report(&mut lock(&p), &report);
                }
                if last_push.elapsed() > PUSHALL_EVERY {
                    pushall(&client, serial);
                    last_push = Instant::now();
                }
            }
            Ok(_) => {}
            Err(e) => {
                {
                    let mut g = lock(&p);
                    g.connected = false;
                    g.error = Some(error_text(&e.to_string()));
                }
                // rumqttc se reconnecte au tour suivant ; on laisse souffler l'imprimante
                std::thread::sleep(Duration::from_secs(5));
            }
        }
    }
    let mut g = lock(&p);
    g.client = None;
    g.connected = false;
}

/// Message d'erreur affiché sous « Printer offline », en anglais comme tout l'écran.
fn error_text(e: &str) -> String {
    let l = e.to_lowercase();
    if l.contains("notauthorized") || l.contains("not authorized") || l.contains("badusername") || l.contains("bad user") {
        "Wrong access code · check it in Dot Companion".into()
    } else if l.contains("timed out") || l.contains("timeout") || l.contains("unreachable") || l.contains("no route") || l.contains("refused") {
        "Printer unreachable · check its IP in Dot Companion".into()
    } else {
        // cause non reconnue : le message brut, pour comprendre (court, sur une ligne)
        let raw: String = e.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(140).collect();
        format!("Connection failed · {raw}")
    }
}

/// Ajoute un rapport à l'état cumulé (seul l'objet `print` nous intéresse).
fn merge_report(g: &mut Printer, report: &Map<String, Value>) {
    g.last_message = Some(Instant::now());
    g.connected = true;
    let Some(Value::Object(print)) = report.get("print") else { return };
    let before = g.print.get("gcode_state").and_then(Value::as_str).map(str::to_string);
    for (k, v) in print {
        // l'AMS arrive souvent par morceaux : on fusionne au niveau de l'objet
        if let (Value::Object(new), Some(Value::Object(old))) = (v, g.print.get_mut(k)) {
            for (k2, v2) in new {
                old.insert(k2.clone(), v2.clone());
            }
        } else {
            g.print.insert(k.clone(), v.clone());
        }
    }
    let after = g.print.get("gcode_state").and_then(Value::as_str);
    if after == Some("FINISH") && before.as_deref() != Some("FINISH") {
        let name = str_of(&g.print, "subtask_name");
        g.last_finished = Some((name, now_ms()));
    }
}

fn str_of(m: &Map<String, Value>, k: &str) -> String {
    match m.get(k) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn num_of(m: &Map<String, Value>, k: &str) -> Option<f64> {
    match m.get(k)? {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

/// Modèle d'après le début du numéro de série.
pub fn model(serial: &str) -> &'static str {
    let s = serial.to_uppercase();
    for (prefix, name) in [("00M", "X1C"), ("00W", "X1"), ("03W", "X1E"), ("01S", "P1P"), ("01P", "P1S"), ("030", "A1 mini"), ("039", "A1"), ("094", "H2D")] {
        if s.starts_with(prefix) {
            return name;
        }
    }
    "Bambu Lab"
}

fn ago(ms: u64) -> String {
    let m = now_ms().saturating_sub(ms) / 60000;
    match m {
        0 => "just now".into(),
        1..=59 => format!("{m} min ago"),
        60..=1439 => format!("{}h ago", m / 60),
        _ => format!("{}d ago", m / 1440),
    }
}

/// État de l'imprimante d'une page, au format du rendu.
pub fn state(t: &Target) -> Value {
    if !t.ready() {
        return json!({ "state": "offline", "hint": "Set the printer IP, serial number and access code in Dot Companion" });
    }
    let p = printer(t);
    let g = lock(&p);
    let silent = g.last_message.map(|l| l.elapsed() > SILENT).unwrap_or(true);
    if !g.connected || silent || g.print.is_empty() {
        let hint = g.error.clone().unwrap_or_else(|| "Connecting to the printer…".into());
        return json!({ "state": "offline", "model": model(&t.serial), "hint": hint });
    }
    build(&g, &t.serial)
}

/// Traduit l'état cumulé de l'imprimante (champs de Bambu Lab) en état du rendu.
fn build(g: &Printer, serial: &str) -> Value {
    let p = &g.print;
    let gstate = str_of(p, "gcode_state");
    let print_error = num_of(p, "print_error").unwrap_or(0.0) as u64;
    let state = match gstate.as_str() {
        "RUNNING" | "PREPARE" | "SLICING" => "printing",
        "PAUSE" => "paused",
        "FAILED" => "error",
        "FINISH" => "finished",
        _ => "idle",
    };
    let state = if print_error != 0 && (state == "printing" || state == "paused") { "error" } else { state };
    let speed = match num_of(p, "spd_lvl").unwrap_or(2.0) as u64 {
        1 => "Silent",
        3 => "Sport",
        4 => "Ludicrous",
        _ => "Standard",
    };
    let file = match str_of(p, "subtask_name") {
        f if f.is_empty() => str_of(p, "gcode_file"),
        f => f,
    };
    let mut out = json!({
        "state": state,
        "model": model(serial),
        "pct": num_of(p, "mc_percent"),
        "layer": num_of(p, "layer_num"),
        "layers": num_of(p, "total_layer_num"),
        "left": num_of(p, "mc_remaining_time"),
        "file": file,
        "speed": speed,
        "nozzle": { "v": num_of(p, "nozzle_temper"), "t": num_of(p, "nozzle_target_temper") },
        "bed": { "v": num_of(p, "bed_temper"), "t": num_of(p, "bed_target_temper") },
        "light": light_on(p),
    });
    // chambre : seulement les X1 ont la sonde ; ailleurs, ventilateur de pièce (0 à 15) en %
    if model(serial).starts_with('X') {
        out["chamber"] = json!(num_of(p, "chamber_temper"));
    } else {
        out["fan"] = json!(num_of(p, "cooling_fan_speed").map(|f| ((f / 15.0) * 100.0).round()));
    }
    let (ams, tray) = ams(p);
    out["ams"] = ams;
    out["tray"] = tray;
    // humidité de l'AMS : en % sur les firmwares récents (humidity_raw), sinon un niveau de 1 à 5 ; température
    if let Some(unit) = first_ams(p) {
        out["amsHumidity"] = json!(num_of(unit, "humidity_raw").filter(|h| *h > 0.0));
        out["amsHumidityLevel"] = json!(num_of(unit, "humidity").filter(|h| *h >= 1.0 && *h <= 5.0));
        out["amsTemp"] = json!(num_of(unit, "temp").filter(|t| *t > 0.0));
    }
    if state == "error" {
        out["error"] = json!(error_message(p, print_error));
    }
    if let Some((file, at)) = &g.last_finished {
        out["last"] = json!({ "file": file, "ago": ago(*at) });
        if state == "finished" {
            out["doneAt"] = json!(at);
        }
    } else if state == "idle" && !str_of(p, "subtask_name").is_empty() {
        out["last"] = json!({ "file": str_of(p, "subtask_name") });
    }
    out
}

fn light_on(p: &Map<String, Value>) -> bool {
    p.get("lights_report")
        .and_then(Value::as_array)
        .map(|l| l.iter().any(|x| x.get("node").and_then(Value::as_str) == Some("chamber_light") && x.get("mode").and_then(Value::as_str) == Some("on")))
        .unwrap_or(false)
}

/// Le premier AMS du rapport.
fn first_ams(p: &Map<String, Value>) -> Option<&Map<String, Value>> {
    p.get("ams")?.get("ams")?.as_array()?.first()?.as_object()
}

/// Emplacements de l'AMS (le premier AMS) et emplacement en cours.
fn ams(p: &Map<String, Value>) -> (Value, Value) {
    let Some(Value::Object(a)) = p.get("ams") else { return (json!([]), Value::Null) };
    let units = a.get("ams").and_then(Value::as_array).cloned().unwrap_or_default();
    let Some(first) = units.first() else { return (json!([]), Value::Null) };
    let trays = first.get("tray").and_then(Value::as_array).cloned().unwrap_or_default();
    let list: Vec<Value> = trays
        .iter()
        .map(|t| {
            let ty = t.get("tray_type").and_then(Value::as_str).unwrap_or("");
            if ty.is_empty() {
                return json!({});
            }
            let color = t.get("tray_color").and_then(Value::as_str).filter(|c| c.len() >= 6).map(|c| format!("#{}", &c[..6].to_lowercase()));
            let remain = t.get("remain").and_then(Value::as_i64).filter(|r| *r >= 0).map(|r| r as f64 / 100.0);
            json!({ "type": ty, "color": color, "remain": remain })
        })
        .collect();
    // tray_now : numéro global de l'emplacement (AMS × 4 + emplacement) ; 254 bobine externe, 255 aucun
    let now = a.get("tray_now").and_then(|v| v.as_str().map(str::to_string).or_else(|| v.as_i64().map(|n| n.to_string()))).and_then(|s| s.parse::<i64>().ok());
    let tray = match now {
        Some(n) if (0..4).contains(&n) => json!(n),
        _ => Value::Null,
    };
    (Value::Array(list), tray)
}

/// Message d'erreur en clair pour les cas les plus courants, le code sinon.
fn error_message(p: &Map<String, Value>, print_error: u64) -> String {
    let hms: Vec<(u64, u64)> = p
        .get("hms")
        .and_then(Value::as_array)
        .map(|l| l.iter().filter_map(|h| Some((h.get("attr")?.as_u64()?, h.get("code")?.as_u64()?))).collect())
        .unwrap_or_default();
    let code = if print_error != 0 { format!("{:08X}", print_error) } else { hms.first().map(|(a, c)| format!("{:08X}{:08X}", a, c)).unwrap_or_default() };
    // 0x0700_xxxx et 0x0701_xxxx : AMS ; 0x0300_xxxx : impression ; 0x0C00_xxxx : caméra et détection
    let text = match code.get(..4) {
        Some("0700") | Some("0701") | Some("0702") | Some("0703") => "AMS needs attention",
        Some("0300") => "Print paused by the printer",
        Some("0500") => "Printer needs attention",
        Some("0C00") => "First layer or spaghetti detected",
        _ => "Printer error",
    };
    if code.is_empty() {
        text.into()
    } else {
        format!("{text} · code {}", code.as_bytes().chunks(4).map(|c| String::from_utf8_lossy(c).into_owned()).collect::<Vec<_>>().join("-"))
    }
}

/// Commande pour l'imprimante d'une page : light (bascule la lampe), pause, resume, stop.
pub fn command(t: &Target, cmd: &str) -> bool {
    if !t.ready() {
        return false;
    }
    let p = printer(t);
    let g = lock(&p);
    let Some(client) = g.client.clone() else { return false };
    let body = match cmd {
        "pause" | "resume" | "stop" => json!({ "print": { "sequence_id": "0", "command": cmd, "param": "" } }),
        "light" => {
            let mode = if light_on(&g.print) { "off" } else { "on" };
            json!({ "system": { "sequence_id": "0", "command": "ledctrl", "led_node": "chamber_light", "led_mode": mode,
                "led_on_time": 500, "led_off_time": 500, "loop_times": 0, "interval_time": 0 } })
        }
        _ => return false,
    };
    drop(g);
    let ok = request(&client, &t.serial, body);
    // l'imprimante renverra l'état ; on le demande tout de suite pour un écran à jour
    if ok {
        pushall(&client, &t.serial);
    }
    ok
}

#[cfg(test)]
mod tests {
    use super::*;

    fn printer_from(reports: &[Value]) -> Printer {
        let mut g = Printer::default();
        for r in reports {
            merge_report(&mut g, r.as_object().unwrap());
        }
        g
    }

    #[test]
    fn modele() {
        assert_eq!(model("01P00A123456789"), "P1S");
        assert_eq!(model("00M09C123456789"), "X1C");
        assert_eq!(model("ABC"), "Bambu Lab");
    }

    #[test]
    fn impression_p1s() {
        // rapport complet (pushall) puis un rapport partiel, comme le P1S
        let g = printer_from(&[
            json!({ "print": {
                "gcode_state": "RUNNING", "mc_percent": 42, "mc_remaining_time": 131, "layer_num": 88, "total_layer_num": 240,
                "subtask_name": "Desk_hook_v3", "nozzle_temper": 218.6, "nozzle_target_temper": 220, "bed_temper": 59.8, "bed_target_temper": 60,
                "cooling_fan_speed": "15", "spd_lvl": 2, "print_error": 0,
                "lights_report": [{ "node": "chamber_light", "mode": "on" }],
                "ams": { "tray_now": "1", "ams": [{ "id": "0", "humidity": "4", "humidity_raw": "41", "temp": "26.4", "tray": [
                    { "id": "0", "tray_type": "PLA", "tray_color": "000000FF", "remain": 90 },
                    { "id": "1", "tray_type": "PETG", "tray_color": "FF6A00FF", "remain": -1 },
                    { "id": "2" }, { "id": "3", "tray_type": "PLA", "tray_color": "FFFFFFFF", "remain": 40 } ] }] } } }),
            json!({ "print": { "mc_percent": 43, "nozzle_temper": 219.9 } }),
        ]);
        let s = build(&g, "01P00A123456789");
        assert_eq!(s["state"], "printing");
        assert_eq!(s["model"], "P1S");
        assert_eq!(s["pct"], 43.0);
        assert_eq!(s["layer"], 88.0);
        assert_eq!(s["nozzle"]["v"], 219.9);
        assert_eq!(s["fan"], 100.0);
        assert!(s.get("chamber").is_none());
        assert_eq!(s["light"], true);
        assert_eq!(s["tray"], 1);
        assert_eq!(s["ams"][0]["color"], "#000000");
        assert_eq!(s["ams"][1]["remain"], Value::Null);
        assert_eq!(s["ams"][2], json!({}));
        assert_eq!(s["ams"][3]["remain"], 0.4);
        assert_eq!(s["amsHumidity"], 41.0);
        assert_eq!(s["amsHumidityLevel"], 4.0);
        assert_eq!(s["amsTemp"], 26.4);
    }

    #[test]
    fn erreur_et_fin() {
        let g = printer_from(&[json!({ "print": { "gcode_state": "PAUSE", "print_error": 0x0700_8011u64, "subtask_name": "Benchy" } })]);
        let s = build(&g, "01P00A1");
        assert_eq!(s["state"], "error");
        assert_eq!(s["error"], "AMS needs attention · code 0700-8011");
        let g = printer_from(&[json!({ "print": { "gcode_state": "RUNNING", "subtask_name": "Benchy" } }), json!({ "print": { "gcode_state": "FINISH" } })]);
        let s = build(&g, "01P00A1");
        assert_eq!(s["state"], "finished");
        assert_eq!(s["last"]["file"], "Benchy");
    }

    #[test]
    fn messages() {
        assert!(error_text("Connection refused, return code: `NotAuthorized`").starts_with("Wrong access code"));
        assert!(error_text("Connection refused, return code: `BadUserNamePassword`").starts_with("Wrong access code"));
        assert!(error_text("I/O: Connection timed out (os error 110)").starts_with("Printer unreachable"));
        assert_eq!(error_text("TLS: Io(bizarre)"), "Connection failed · TLS: Io(bizarre)");
    }

    #[test]
    fn reglages_incomplets() {
        let s = state(&Target { ip: "".into(), serial: "01P".into(), code: "".into() });
        assert_eq!(s["state"], "offline");
    }

    #[test]
    fn tls_pret() {
        assert!(tls().is_some());
    }
}
