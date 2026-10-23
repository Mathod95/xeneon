//! Edge Swipe Test — vérifie si iCUE accepte un swipe simulé sur le CORSAIR XENEON EDGE.
//! Aucune dépendance : appels Win32 directs (user32.dll).

#![allow(non_snake_case, clippy::upper_case_acronyms)]

use std::io::{self, Write};
use std::thread::sleep;
use std::time::Duration;

// ------------------------------------------------------------------ Win32 FFI
type BOOL = i32;
type HANDLE = isize;

#[repr(C)]
#[derive(Clone, Copy, Default, Debug)]
struct RECT { left: i32, top: i32, right: i32, bottom: i32 }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct POINT { x: i32, y: i32 }

#[repr(C)]
struct MONITORINFOEXW { cbSize: u32, rcMonitor: RECT, rcWork: RECT, dwFlags: u32, szDevice: [u16; 32] }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct POINTER_INFO {
    pointerType: u32, pointerId: u32, frameId: u32, pointerFlags: u32,
    sourceDevice: HANDLE, hwndTarget: HANDLE,
    ptPixelLocation: POINT, ptHimetricLocation: POINT,
    ptPixelLocationRaw: POINT, ptHimetricLocationRaw: POINT,
    dwTime: u32, historyCount: u32, InputData: i32, dwKeyStates: u32,
    PerformanceCount: u64, ButtonChangeType: i32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct POINTER_TOUCH_INFO {
    pointerInfo: POINTER_INFO, touchFlags: u32, touchMask: u32,
    rcContact: RECT, rcContactRaw: RECT, orientation: u32, pressure: u32,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct MOUSEINPUT { dx: i32, dy: i32, mouseData: u32, dwFlags: u32, time: u32, dwExtraInfo: usize }

#[repr(C)]
#[derive(Clone, Copy)]
struct INPUT { r#type: u32, mi: MOUSEINPUT }

type MonitorEnumProc = unsafe extern "system" fn(isize, isize, *mut RECT, isize) -> BOOL;

#[link(name = "user32")]
extern "system" {
    fn EnumDisplayMonitors(hdc: isize, clip: *const RECT, cb: MonitorEnumProc, data: isize) -> BOOL;
    fn GetMonitorInfoW(hmon: isize, info: *mut MONITORINFOEXW) -> BOOL;
    fn SetProcessDpiAwarenessContext(ctx: isize) -> BOOL;
    fn InitializeTouchInjection(max: u32, mode: u32) -> BOOL;
    fn InjectTouchInput(count: u32, contacts: *const POINTER_TOUCH_INFO) -> BOOL;
    fn GetCursorPos(p: *mut POINT) -> BOOL;
    fn SetCursorPos(x: i32, y: i32) -> BOOL;
    fn SendInput(n: u32, inputs: *const INPUT, size: i32) -> u32;
}
#[link(name = "kernel32")]
extern "system" { fn GetLastError() -> u32; }

const PT_TOUCH: u32 = 2;
const TOUCH_FEEDBACK_DEFAULT: u32 = 1;
const PF_INRANGE: u32 = 0x2;
const PF_INCONTACT: u32 = 0x4;
const PF_DOWN: u32 = 0x1_0000;
const PF_UPDATE: u32 = 0x2_0000;
const PF_UP: u32 = 0x4_0000;
const TOUCH_MASK_ALL: u32 = 0x7;
const MOUSEEVENTF_LEFTDOWN: u32 = 0x2;
const MOUSEEVENTF_LEFTUP: u32 = 0x4;

// ------------------------------------------------------------------ monitors
#[derive(Clone)]
struct Monitor { name: String, rc: RECT }
impl Monitor {
    fn w(&self) -> i32 { self.rc.right - self.rc.left }
    fn h(&self) -> i32 { self.rc.bottom - self.rc.top }
    fn is_edge(&self) -> bool { (self.w() == 2560 && self.h() == 720) || (self.w() == 720 && self.h() == 2560) }
}

unsafe extern "system" fn enum_cb(hmon: isize, _: isize, _: *mut RECT, data: isize) -> BOOL {
    let list = &mut *(data as *mut Vec<Monitor>);
    let mut mi: MONITORINFOEXW = std::mem::zeroed();
    mi.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    if GetMonitorInfoW(hmon, &mut mi) != 0 {
        let end = mi.szDevice.iter().position(|&c| c == 0).unwrap_or(32);
        list.push(Monitor { name: String::from_utf16_lossy(&mi.szDevice[..end]), rc: mi.rcMonitor });
    }
    1
}

fn monitors() -> Vec<Monitor> {
    let mut v: Vec<Monitor> = Vec::new();
    unsafe { EnumDisplayMonitors(0, std::ptr::null(), enum_cb, &mut v as *mut _ as isize); }
    v
}

// ------------------------------------------------------------------ gestures
/// Points de départ / arrivée d'un swipe "page suivante" (doigt de droite à gauche).
fn swipe_path(m: &Monitor, cross: f32) -> ((i32, i32), (i32, i32)) {
    let (l, t, w, h) = (m.rc.left, m.rc.top, m.w(), m.h());
    if w >= h {
        let y = t + (h as f32 * cross) as i32;
        ((l + (w as f32 * 0.70) as i32, y), (l + (w as f32 * 0.30) as i32, y))
    } else {
        let x = l + (w as f32 * cross) as i32;
        ((x, t + (h as f32 * 0.70) as i32), (x, t + (h as f32 * 0.30) as i32))
    }
}

fn touch_swipe(from: (i32, i32), to: (i32, i32)) -> Result<(), String> {
    const STEPS: i32 = 14;
    let contact = |x: i32, y: i32, flags: u32| {
        let mut c = POINTER_TOUCH_INFO::default();
        c.pointerInfo.pointerType = PT_TOUCH;
        c.pointerInfo.pointerId = 0;
        c.pointerInfo.pointerFlags = flags;
        c.pointerInfo.ptPixelLocation = POINT { x, y };
        c.touchMask = TOUCH_MASK_ALL;
        c.rcContact = RECT { left: x - 4, top: y - 4, right: x + 4, bottom: y + 4 };
        c.orientation = 90;
        c.pressure = 32000;
        c
    };
    let send = |c: POINTER_TOUCH_INFO| -> Result<(), String> {
        if unsafe { InjectTouchInput(1, &c) } == 0 {
            Err(format!("InjectTouchInput a échoué (code {})", unsafe { GetLastError() }))
        } else { Ok(()) }
    };
    send(contact(from.0, from.1, PF_DOWN | PF_INRANGE | PF_INCONTACT))?;
    for i in 1..=STEPS {
        sleep(Duration::from_millis(12));
        let x = from.0 + (to.0 - from.0) * i / STEPS;
        let y = from.1 + (to.1 - from.1) * i / STEPS;
        send(contact(x, y, PF_UPDATE | PF_INRANGE | PF_INCONTACT))?;
    }
    sleep(Duration::from_millis(12));
    send(contact(to.0, to.1, PF_UP))
}

fn mouse_swipe(from: (i32, i32), to: (i32, i32)) {
    const STEPS: i32 = 14;
    let click = |flags: u32| {
        let i = INPUT { r#type: 0, mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } };
        unsafe { SendInput(1, &i, std::mem::size_of::<INPUT>() as i32); }
    };
    unsafe {
        let mut saved = POINT::default();
        GetCursorPos(&mut saved);
        SetCursorPos(from.0, from.1);
        sleep(Duration::from_millis(30));
        click(MOUSEEVENTF_LEFTDOWN);
        for i in 1..=STEPS {
            sleep(Duration::from_millis(12));
            SetCursorPos(from.0 + (to.0 - from.0) * i / STEPS, from.1 + (to.1 - from.1) * i / STEPS);
        }
        sleep(Duration::from_millis(12));
        click(MOUSEEVENTF_LEFTUP);
        sleep(Duration::from_millis(30));
        SetCursorPos(saved.x, saved.y);
    }
}

// ------------------------------------------------------------------ console
fn prompt(msg: &str) -> String {
    print!("{msg}");
    io::stdout().flush().ok();
    let mut s = String::new();
    io::stdin().read_line(&mut s).ok();
    s.trim().to_lowercase()
}

fn yes(msg: &str) -> bool {
    loop {
        match prompt(msg).as_str() {
            "o" | "oui" | "y" | "yes" => return true,
            "n" | "non" | "no" => return false,
            _ => println!("  Répondez o (oui) ou n (non)."),
        }
    }
}

fn countdown() {
    for s in (1..=3).rev() { print!("  {s}… "); io::stdout().flush().ok(); sleep(Duration::from_secs(1)); }
    println!("swipe !");
}

fn main() {
    unsafe { SetProcessDpiAwarenessContext(-4); } // per-monitor v2 : coordonnées en pixels réels

    println!("=================================================");
    println!("  EDGE SWIPE TEST — CORSAIR XENEON EDGE / iCUE");
    println!("=================================================\n");
    println!("Ce test simule un swipe « page suivante » sur l'Edge.");
    println!("Avant de commencer : affichez une page iCUE qui a une page après elle,");
    println!("et retenez son numéro.\n");

    let mons = monitors();
    for (i, m) in mons.iter().enumerate() {
        println!("  [{}] {}  {}x{} à ({}, {}){}", i + 1, m.name, m.w(), m.h(), m.rc.left, m.rc.top,
            if m.is_edge() { "   <- XENEON EDGE" } else { "" });
    }
    let edge = match mons.iter().find(|m| m.is_edge()) {
        Some(m) => m.clone(),
        None => {
            println!("\nAucun écran 2560x720 détecté automatiquement.");
            let n: usize = prompt("Numéro de l'écran de l'Edge : ").parse().unwrap_or(0);
            match mons.get(n.wrapping_sub(1)) { Some(m) => m.clone(), None => { prompt("Écran invalide. Entrée pour quitter."); return; } }
        }
    };
    println!("\nÉcran utilisé : {} ({}x{})\n", edge.name, edge.w(), edge.h());

    let touch_ok = unsafe { InitializeTouchInjection(1, TOUCH_FEEDBACK_DEFAULT) } != 0;
    if !touch_ok { println!("(!) Injection tactile indisponible (code {}).\n", unsafe { GetLastError() }); }

    let mut results: Vec<(&str, &str)> = Vec::new();
    let tests: [(&str, f32, bool); 3] = [
        ("Tactile, milieu de l'écran", 0.50, true),
        ("Tactile, haut de l'écran", 0.08, true),
        ("Souris (glisser-déposer)", 0.50, false),
    ];

    for (n, (label, cross, is_touch)) in tests.iter().enumerate() {
        println!("--- Test {}/3 : {label}", n + 1);
        if *is_touch && !touch_ok { println!("  ignoré (injection tactile indisponible)\n"); results.push((label, "ignoré")); continue; }
        prompt("  Entrée pour lancer (ne touchez pas l'écran)… ");
        countdown();
        let (from, to) = swipe_path(&edge, *cross);
        let res = if *is_touch { touch_swipe(from, to) } else { mouse_swipe(from, to); Ok(()) };
        if let Err(e) = res { println!("  Erreur : {e}\n"); results.push((label, "erreur")); continue; }
        sleep(Duration::from_millis(600));
        let ok = yes("  La page iCUE a-t-elle changé ? (o/n) ");
        results.push((label, if ok { "OUI" } else { "non" }));
        println!();
        if ok { break; }
    }

    println!("=================== RÉSULTAT ===================");
    for (l, r) in &results { println!("  {l:<30} {r}"); }
    println!("================================================");
    if !results.iter().any(|(_, r)| *r == "OUI") {
        println!("\nAucun swipe n'a été accepté. Réessayez une fois en faisant");
        println!("clic droit sur le programme -> « Exécuter en tant qu'administrateur »");
        println!("(iCUE bloque peut-être les programmes non administrateurs).");
    }
    println!("\nEnvoyez une capture de ce résultat dans la conversation.");
    prompt("\nEntrée pour fermer. ");
}
