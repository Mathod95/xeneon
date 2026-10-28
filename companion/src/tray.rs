//! Icône de Dot Companion dans la zone de notification de Windows (plus de fenêtre console).
//!
//! - clic gauche : ouvre la page de réglages dans le navigateur du PC ;
//! - clic droit : menu (version et Dot Hub connectés, Ouvrir les réglages, Identifier les Dot Hub,
//!   Démarrer avec Windows, Rechercher une mise à jour / Mettre à jour, Quitter) ;
//! - l'infobulle dit si une mise à jour est disponible (rafraîchie chaque minute).
//!
//! API Win32 appelée directement (user32, shell32, gdi32, kernel32), sans dépendance de plus.
//! Sous Linux, `cargo check --features check-win` vérifie ce fichier sans le lier.
#![allow(clippy::upper_case_acronyms, non_snake_case)]

use std::sync::atomic::{AtomicIsize, Ordering};

type HWND = isize;
type HMENU = isize;
type HICON = isize;
type HBITMAP = isize;
type HINSTANCE = isize;
type WPARAM = usize;
type LPARAM = isize;
type LRESULT = isize;
type BOOL = i32;
type WndProc = unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT;

#[repr(C)]
struct WNDCLASSEXW {
    cbSize: u32,
    style: u32,
    lpfnWndProc: Option<WndProc>,
    cbClsExtra: i32,
    cbWndExtra: i32,
    hInstance: HINSTANCE,
    hIcon: HICON,
    hCursor: isize,
    hbrBackground: isize,
    lpszMenuName: *const u16,
    lpszClassName: *const u16,
    hIconSm: HICON,
}

#[repr(C)]
struct Guid {
    d1: u32,
    d2: u16,
    d3: u16,
    d4: [u8; 8],
}

#[repr(C)]
struct NOTIFYICONDATAW {
    cbSize: u32,
    hWnd: HWND,
    uID: u32,
    uFlags: u32,
    uCallbackMessage: u32,
    hIcon: HICON,
    szTip: [u16; 128],
    dwState: u32,
    dwStateMask: u32,
    szInfo: [u16; 256],
    uVersion: u32,
    szInfoTitle: [u16; 64],
    dwInfoFlags: u32,
    guidItem: Guid,
    hBalloonIcon: HICON,
}

#[repr(C)]
struct POINT {
    x: i32,
    y: i32,
}

#[repr(C)]
struct MSG {
    hwnd: HWND,
    message: u32,
    wParam: WPARAM,
    lParam: LPARAM,
    time: u32,
    pt: POINT,
    _reserved: [u32; 4],
}

#[repr(C)]
struct ICONINFO {
    fIcon: BOOL,
    xHotspot: u32,
    yHotspot: u32,
    hbmMask: HBITMAP,
    hbmColor: HBITMAP,
}

#[link(name = "user32")]
extern "system" {
    fn RegisterClassExW(c: *const WNDCLASSEXW) -> u16;
    fn CreateWindowExW(ex: u32, class: *const u16, name: *const u16, style: u32, x: i32, y: i32, w: i32, h: i32, parent: HWND, menu: HMENU, inst: HINSTANCE, param: *const core::ffi::c_void) -> HWND;
    fn DefWindowProcW(h: HWND, m: u32, w: WPARAM, l: LPARAM) -> LRESULT;
    fn GetMessageW(msg: *mut MSG, h: HWND, min: u32, max: u32) -> BOOL;
    fn TranslateMessage(msg: *const MSG) -> BOOL;
    fn DispatchMessageW(msg: *const MSG) -> LRESULT;
    fn CreatePopupMenu() -> HMENU;
    fn AppendMenuW(m: HMENU, flags: u32, id: usize, text: *const u16) -> BOOL;
    fn TrackPopupMenu(m: HMENU, flags: u32, x: i32, y: i32, reserved: i32, h: HWND, rect: *const core::ffi::c_void) -> BOOL;
    fn DestroyMenu(m: HMENU) -> BOOL;
    fn SetForegroundWindow(h: HWND) -> BOOL;
    fn GetCursorPos(p: *mut POINT) -> BOOL;
    fn PostMessageW(h: HWND, m: u32, w: WPARAM, l: LPARAM) -> BOOL;
    fn MessageBoxW(h: HWND, text: *const u16, caption: *const u16, kind: u32) -> i32;
    fn CreateIconIndirect(info: *const ICONINFO) -> HICON;
    fn RegisterWindowMessageW(name: *const u16) -> u32;
    fn SetTimer(h: HWND, id: usize, ms: u32, f: *const core::ffi::c_void) -> usize;
}
#[link(name = "shell32")]
extern "system" {
    fn Shell_NotifyIconW(msg: u32, data: *const NOTIFYICONDATAW) -> BOOL;
}
#[link(name = "gdi32")]
extern "system" {
    fn CreateBitmap(w: i32, h: i32, planes: u32, bits: u32, data: *const core::ffi::c_void) -> HBITMAP;
    fn DeleteObject(o: isize) -> BOOL;
}
#[link(name = "kernel32")]
extern "system" {
    fn GetModuleHandleW(name: *const u16) -> HINSTANCE;
}

const WM_COMMAND: u32 = 0x0111;
const WM_TIMER: u32 = 0x0113;
const WM_LBUTTONUP: u32 = 0x0202;
const WM_RBUTTONUP: u32 = 0x0205;
const WM_CONTEXTMENU: u32 = 0x007B;
const WM_NULL: u32 = 0;
const WM_TRAY: u32 = 0x8000 + 1; // WM_APP + 1
const NIM_ADD: u32 = 0;
const NIM_MODIFY: u32 = 1;
const NIM_DELETE: u32 = 2;
const NIF_MESSAGE: u32 = 1;
const NIF_ICON: u32 = 2;
const NIF_TIP: u32 = 4;
const MF_STRING: u32 = 0;
const MF_GRAYED: u32 = 1;
const MF_CHECKED: u32 = 8;
const MF_SEPARATOR: u32 = 0x800;
const TPM_RIGHTBUTTON: u32 = 2;
const TPM_BOTTOMALIGN: u32 = 0x20;
const TPM_NONOTIFY: u32 = 0x80;
const TPM_RETURNCMD: u32 = 0x100;
const MB_ICONWARNING: u32 = 0x30;

const ID_OPEN: usize = 1;
const ID_IDENTIFY: usize = 2;
const ID_STARTUP: usize = 3;
const ID_UPDATE: usize = 4;
const ID_QUIT: usize = 5;

static HWND_TRAY: AtomicIsize = AtomicIsize::new(0);
static HICON_TRAY: AtomicIsize = AtomicIsize::new(0);
static MSG_TASKBAR: AtomicIsize = AtomicIsize::new(0);

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Message d'erreur (le compagnon n'a plus de console où l'écrire).
pub fn message_box(text: &str) {
    let (t, c) = (wide(text), wide("Dot Companion"));
    unsafe {
        MessageBoxW(0, t.as_ptr(), c.as_ptr(), MB_ICONWARNING);
    }
}

/// Icône 32 × 32 : 4 × 4 points, les 12 du centre en vert d'accent, les angles éteints.
fn make_icon() -> HICON {
    const S: usize = 32;
    let pattern = [".##.", "####", "####", ".##."];
    let mut px = vec![0u8; S * S * 4];
    let pitch = S as f32 / 4.0;
    for y in 0..S {
        for x in 0..S {
            let (cx, cy) = ((x as f32 / pitch) as usize, (y as f32 / pitch) as usize);
            let (dx, dy) = (x as f32 + 0.5 - (cx as f32 + 0.5) * pitch, y as f32 + 0.5 - (cy as f32 + 0.5) * pitch);
            let d = (dx * dx + dy * dy).sqrt();
            let r = pitch * 0.4;
            let cover = (r + 0.5 - d).clamp(0.0, 1.0);
            if cover <= 0.0 {
                continue;
            }
            let lit = pattern[cy].as_bytes()[cx] == b'#';
            let (b, g, r_, a) = if lit { (0x81u8, 0xB9u8, 0x10u8, 255.0) } else { (0x60, 0x60, 0x60, 140.0) };
            let i = (y * S + x) * 4;
            px[i] = b;
            px[i + 1] = g;
            px[i + 2] = r_;
            px[i + 3] = (a * cover) as u8;
        }
    }
    let mask = vec![0u8; S * S / 8];
    unsafe {
        let color = CreateBitmap(S as i32, S as i32, 1, 32, px.as_ptr().cast());
        let mbm = CreateBitmap(S as i32, S as i32, 1, 1, mask.as_ptr().cast());
        let info = ICONINFO { fIcon: 1, xHotspot: 0, yHotspot: 0, hbmMask: mbm, hbmColor: color };
        let icon = CreateIconIndirect(&info);
        DeleteObject(color);
        DeleteObject(mbm);
        icon
    }
}

fn tip_text() -> String {
    let mut t = format!("Dot Companion {}", crate::VERSION);
    if let Some(v) = crate::update::available() {
        t.push_str(&format!(" · mise à jour {v} disponible"));
    }
    t
}

fn notify(op: u32) {
    let hwnd = HWND_TRAY.load(Ordering::Relaxed);
    if hwnd == 0 {
        return;
    }
    let mut d = NOTIFYICONDATAW {
        cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
        hWnd: hwnd,
        uID: 1,
        uFlags: NIF_MESSAGE | NIF_ICON | NIF_TIP,
        uCallbackMessage: WM_TRAY,
        hIcon: HICON_TRAY.load(Ordering::Relaxed),
        szTip: [0; 128],
        dwState: 0,
        dwStateMask: 0,
        szInfo: [0; 256],
        uVersion: 0,
        szInfoTitle: [0; 64],
        dwInfoFlags: 0,
        guidItem: Guid { d1: 0, d2: 0, d3: 0, d4: [0; 8] },
        hBalloonIcon: 0,
    };
    for (i, c) in tip_text().encode_utf16().take(127).enumerate() {
        d.szTip[i] = c;
    }
    unsafe {
        Shell_NotifyIconW(op, &d);
    }
}

/// Retire l'icône (avant de quitter, ou de redémarrer après une mise à jour).
pub fn remove() {
    notify(NIM_DELETE);
}

fn show_menu(hwnd: HWND) {
    let connected = crate::connected_count();
    let header = format!("Dot Companion {} · {connected} Dot Hub connecté{}", crate::VERSION, if connected > 1 { "s" } else { "" });
    let update = match crate::update::available() {
        Some(v) => format!("Mettre à jour vers {v}"),
        None if crate::update::installing() => "Mise à jour en cours…".to_string(),
        None => "Rechercher une mise à jour".to_string(),
    };
    let items: [(u32, usize, String); 8] = [
        (MF_STRING | MF_GRAYED, 0, header),
        (MF_SEPARATOR, 0, String::new()),
        (MF_STRING, ID_OPEN, "Ouvrir les réglages".to_string()),
        (MF_STRING, ID_IDENTIFY, "Identifier les Dot Hub".to_string()),
        (MF_SEPARATOR, 0, String::new()),
        (MF_STRING | if crate::startup::enabled() { MF_CHECKED } else { 0 }, ID_STARTUP, "Démarrer avec Windows".to_string()),
        (MF_STRING | if crate::update::installing() { MF_GRAYED } else { 0 }, ID_UPDATE, update),
        (MF_STRING, ID_QUIT, "Quitter".to_string()),
    ];
    unsafe {
        let menu = CreatePopupMenu();
        for (i, (flags, id, text)) in items.iter().enumerate() {
            if i == 7 {
                AppendMenuW(menu, MF_SEPARATOR, 0, std::ptr::null());
            }
            let t = wide(text);
            AppendMenuW(menu, *flags, *id, if *flags & MF_SEPARATOR != 0 { std::ptr::null() } else { t.as_ptr() });
        }
        let mut p = POINT { x: 0, y: 0 };
        GetCursorPos(&mut p);
        SetForegroundWindow(hwnd);
        let cmd = TrackPopupMenu(menu, TPM_RIGHTBUTTON | TPM_BOTTOMALIGN | TPM_RETURNCMD | TPM_NONOTIFY, p.x, p.y, 0, hwnd, std::ptr::null());
        PostMessageW(hwnd, WM_NULL, 0, 0);
        DestroyMenu(menu);
        if cmd > 0 {
            PostMessageW(hwnd, WM_COMMAND, cmd as usize, 0);
        }
    }
}

fn command(id: usize) {
    match id {
        ID_OPEN => {
            crate::open_settings();
        }
        ID_IDENTIFY => crate::identify_all(),
        ID_STARTUP => {
            crate::startup::set(!crate::startup::enabled());
        }
        ID_UPDATE => {
            if crate::update::available().is_some() {
                crate::update::install_async();
            } else {
                crate::update::check_async();
            }
        }
        ID_QUIT => crate::quit(),
        _ => {}
    }
}

unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    match msg {
        WM_TRAY => {
            match lp as u32 {
                WM_LBUTTONUP => {
                    crate::open_settings();
                }
                WM_RBUTTONUP | WM_CONTEXTMENU => show_menu(hwnd),
                _ => {}
            }
            0
        }
        WM_COMMAND => {
            command(wp & 0xffff);
            0
        }
        WM_TIMER => {
            notify(NIM_MODIFY);
            0
        }
        // l'explorateur Windows a redémarré : on remet l'icône
        m if m != 0 && m as isize == MSG_TASKBAR.load(Ordering::Relaxed) => {
            notify(NIM_ADD);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wp, lp),
    }
}

/// Crée l'icône et fait tourner la boucle de messages de Windows (ne revient pas).
pub fn run() -> ! {
    unsafe {
        let inst = GetModuleHandleW(std::ptr::null());
        let class = wide("DotCompanionTray");
        let wc = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
            style: 0,
            lpfnWndProc: Some(wndproc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: inst,
            hIcon: 0,
            hCursor: 0,
            hbrBackground: 0,
            lpszMenuName: std::ptr::null(),
            lpszClassName: class.as_ptr(),
            hIconSm: 0,
        };
        RegisterClassExW(&wc);
        let title = wide("Dot Companion");
        let hwnd = CreateWindowExW(0, class.as_ptr(), title.as_ptr(), 0, 0, 0, 0, 0, 0, 0, inst, std::ptr::null());
        HWND_TRAY.store(hwnd, Ordering::Relaxed);
        HICON_TRAY.store(make_icon(), Ordering::Relaxed);
        let tb = wide("TaskbarCreated");
        MSG_TASKBAR.store(RegisterWindowMessageW(tb.as_ptr()) as isize, Ordering::Relaxed);
        notify(NIM_ADD);
        SetTimer(hwnd, 1, 60_000, std::ptr::null());
        let mut msg = MSG { hwnd: 0, message: 0, wParam: 0, lParam: 0, time: 0, pt: POINT { x: 0, y: 0 }, _reserved: [0; 4] };
        while GetMessageW(&mut msg, 0, 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
    crate::quit()
}
