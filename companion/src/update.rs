//! Mise à jour de Dot Companion depuis l'app, sans repasser par GitHub à la main.
//!
//! - vérifie la dernière release GitHub (au démarrage, puis une fois par jour, ou à la demande) ;
//! - une version plus récente s'affiche dans le menu de l'icône et dans la page de réglages ;
//! - « Mettre à jour » : télécharge `dot-companion.exe`, vérifie son empreinte SHA-256
//!   (`dot-companion.exe.sha256`, publiée avec la release), renomme l'exe en cours
//!   (Windows ne laisse pas l'écraser), met le nouveau à sa place, le lance et quitte ;
//!   le nouveau supprime l'ancien au démarrage.
//!
//! Seulement avec des releases taguées (`v*`), pas avec les exe de GitHub Actions.
//! Pour les essais : `DOT_UPDATE_URL` remplace l'adresse de l'API GitHub.

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const LATEST: &str = "https://api.github.com/repos/Mathod95/xeneon/releases/latest";
const EXE: &str = "dot-companion.exe";

#[derive(Clone)]
pub struct Release {
    pub version: String,
    exe_url: String,
    sha_url: String,
}

#[derive(Default)]
struct State {
    latest: Option<Release>,
    checked: u64,
    busy: bool,
    installing: bool,
    error: Option<String>,
}

static STATE: Mutex<Option<State>> = Mutex::new(None);

fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
    let mut g = STATE.lock().unwrap_or_else(|e| e.into_inner());
    f(g.get_or_insert_with(State::default))
}

/// « 0.10.1 » est plus récent que « 0.9.3 » (comparaison nombre par nombre).
pub fn newer(candidate: &str, current: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> { v.trim_start_matches('v').split(['.', '-']).map(|p| p.parse().unwrap_or(0)).collect() };
    let (a, b) = (parts(candidate), parts(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

/// Réponse de l'API GitHub : version et adresses de l'exe et de son empreinte.
pub fn parse_release(v: &Value) -> Option<Release> {
    let version = v["tag_name"].as_str()?.trim_start_matches('v').to_string();
    let assets = v["assets"].as_array()?;
    let url = |name: &str| assets.iter().find(|a| a["name"].as_str() == Some(name)).and_then(|a| a["browser_download_url"].as_str()).map(str::to_string);
    Some(Release { version, exe_url: url(EXE)?, sha_url: url(&format!("{EXE}.sha256"))? })
}

/// Version plus récente disponible, s'il y en a une.
#[cfg_attr(not(any(windows, feature = "check-win")), allow(dead_code))]
pub fn available() -> Option<String> {
    with(|s| s.latest.as_ref().filter(|r| newer(&r.version, crate::VERSION)).map(|r| r.version.clone()))
}

#[cfg_attr(not(any(windows, feature = "check-win")), allow(dead_code))]
pub fn installing() -> bool {
    with(|s| s.installing)
}

pub fn status_json() -> Value {
    with(|s| {
        json!({
            "current": crate::VERSION,
            "latest": s.latest.as_ref().map(|r| r.version.clone()),
            "available": s.latest.as_ref().map(|r| newer(&r.version, crate::VERSION)).unwrap_or(false),
            "checked": s.checked,
            "checking": s.busy,
            "installing": s.installing,
            "error": s.error,
        })
    })
}

fn check_now() {
    // DOT_UPDATE_URL : autre adresse de « dernière release », pour les essais
    let url = std::env::var("DOT_UPDATE_URL").unwrap_or_else(|_| LATEST.to_string());
    let res = crate::steam::curl_timeout(&url, None, 15).and_then(|b| serde_json::from_slice::<Value>(&b).ok());
    with(|s| {
        s.checked = crate::now_ms();
        s.busy = false;
        match res.as_ref().and_then(parse_release) {
            Some(r) => {
                s.latest = Some(r);
                s.error = None;
            }
            None => s.error = Some("GitHub injoignable ou release sans dot-companion.exe".to_string()),
        }
    });
}

/// Vérifie en arrière-plan (une seule vérification à la fois).
pub fn check_async() {
    if with(|s| std::mem::replace(&mut s.busy, true)) {
        return;
    }
    std::thread::spawn(check_now);
}

/// Vérification au démarrage, puis une fois par jour.
pub fn start_background() {
    std::thread::spawn(|| loop {
        if !with(|s| std::mem::replace(&mut s.busy, true)) {
            check_now();
        }
        std::thread::sleep(std::time::Duration::from_secs(24 * 3600));
    });
}

/// Installe la version disponible en arrière-plan ; le compagnon redémarre tout seul.
pub fn install_async() {
    let Some(rel) = with(|s| if s.installing { None } else { s.latest.clone().filter(|r| newer(&r.version, crate::VERSION)) }) else { return };
    with(|s| {
        s.installing = true;
        s.error = None;
    });
    std::thread::spawn(move || {
        if let Err(e) = install(&rel) {
            with(|s| {
                s.installing = false;
                s.error = Some(e);
            });
        }
    });
}

fn install(rel: &Release) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("exe introuvable : {e}"))?;
    let dir = exe.parent().ok_or("dossier de l'exe introuvable")?.to_path_buf();
    let new = dir.join("dot-companion.new.exe");
    let _ = fs::remove_file(&new);
    crate::steam::curl_timeout(&rel.exe_url, Some(&new), 300).ok_or("téléchargement impossible")?;
    let expected = crate::steam::curl_timeout(&rel.sha_url, None, 15)
        .and_then(|b| String::from_utf8(b).ok())
        .and_then(|t| t.split_whitespace().next().map(|h| h.to_ascii_lowercase()))
        .filter(|h| h.len() == 64)
        .ok_or("empreinte SHA-256 introuvable")?;
    let got = hex(&sha256(&fs::read(&new).map_err(|e| format!("lecture impossible : {e}"))?));
    if got != expected {
        let _ = fs::remove_file(&new);
        return Err("empreinte SHA-256 différente : mise à jour refusée".to_string());
    }
    let old = old_path(&dir);
    let _ = fs::remove_file(&old);
    fs::rename(&exe, &old).map_err(|e| format!("impossible de renommer l'exe : {e}"))?;
    if let Err(e) = fs::rename(&new, &exe) {
        let _ = fs::rename(&old, &exe);
        return Err(format!("impossible d'installer le nouvel exe : {e}"));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&exe, fs::Permissions::from_mode(0o755));
    }
    if let Err(e) = std::process::Command::new(&exe).arg("--updated").spawn() {
        // retour à l'exe d'avant : le compagnon reste tel quel
        let _ = fs::remove_file(&exe);
        let _ = fs::rename(&old, &exe);
        return Err(format!("redémarrage impossible : {e}"));
    }
    crate::quit()
}

fn old_path(dir: &Path) -> PathBuf {
    dir.join("dot-companion.old.exe")
}

/// Après une mise à jour : supprime l'ancien exe (l'ancien compagnon peut mettre un instant à s'arrêter).
pub fn cleanup_old() {
    let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) else { return };
    std::thread::spawn(move || {
        for _ in 0..20 {
            let old = old_path(&dir);
            if !old.exists() || fs::remove_file(&old).is_ok() {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// SHA-256 (FIPS 180-4).
pub fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut msg = data.to_vec();
    let bits = (data.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bits.to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let mut v = h;
        for i in 0..64 {
            let s1 = v[4].rotate_right(6) ^ v[4].rotate_right(11) ^ v[4].rotate_right(25);
            let ch = (v[4] & v[5]) ^ (!v[4] & v[6]);
            let t1 = v[7].wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = v[0].rotate_right(2) ^ v[0].rotate_right(13) ^ v[0].rotate_right(22);
            let maj = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]);
            let t2 = s0.wrapping_add(maj);
            v = [t1.wrapping_add(t2), v[0], v[1], v[2], v[3].wrapping_add(t1), v[4], v[5], v[6]];
        }
        for i in 0..8 {
            h[i] = h[i].wrapping_add(v[i]);
        }
    }
    let mut out = [0u8; 32];
    for (i, x) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&x.to_be_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empreinte() {
        assert_eq!(hex(&sha256(b"abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(hex(&sha256(b"")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        let long = vec![b'a'; 1000];
        assert_eq!(hex(&sha256(&long)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
    }

    #[test]
    fn versions() {
        assert!(newer("0.5.0", "0.4.0"));
        assert!(newer("v0.10.0", "0.9.9"));
        assert!(!newer("0.4.0", "0.4.0"));
        assert!(!newer("0.3.9", "0.4.0"));
    }

    #[test]
    fn release() {
        let v = json!({ "tag_name": "v0.5.0", "assets": [
            { "name": "dot-hub.icuewidget", "browser_download_url": "https://x/dot-hub.icuewidget" },
            { "name": "dot-companion.exe", "browser_download_url": "https://x/dot-companion.exe" },
            { "name": "dot-companion.exe.sha256", "browser_download_url": "https://x/dot-companion.exe.sha256" }
        ]});
        let r = parse_release(&v).unwrap();
        assert_eq!(r.version, "0.5.0");
        assert_eq!(r.exe_url, "https://x/dot-companion.exe");
        assert!(parse_release(&json!({ "tag_name": "v0.5.0", "assets": [] })).is_none());
    }
}
