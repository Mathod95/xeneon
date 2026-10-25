# Dot Frametest : petit serveur local pour tester le widget.
# Lancer : double-clic sur start-server.bat
#     ou : powershell -ExecutionPolicy Bypass -File frametest-server.ps1
# Arrêter : fermer la fenêtre.
# Écoute uniquement sur la machine (127.0.0.1 et ::1), sans droits admin.

$ErrorActionPreference = "Stop"
$port = 8765

$frame = @'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0e0e0e;color:#f2f0e9;font:20px Consolas,monospace}
body{display:grid;gap:14px;align-content:center;justify-items:center;padding:16px;text-align:center}
b{color:#10b981;font-size:28px;letter-spacing:.1em}
button{font:inherit;height:70px;padding:0 28px;border-radius:999px;border:2px solid #10b981;background:#141414;color:#f2f0e9}
input{font:inherit;width:90%;height:56px;padding:0 14px;border-radius:12px;border:2px solid #2a2a2a;background:#080808;color:#f2f0e9}
input.on{border-color:#10b981}
#s{color:#b8b6b0;font-size:16px}
</style></head><body>
<b>IFRAME OK · LOCALHOST</b>
<button id="t">TOUCH ME · 0</button>
<input id="k" placeholder="TAP, THEN TYPE">
<div id="s">waiting for widget…</div>
<script>
var n=0,t=document.getElementById('t'),s=document.getElementById('s');
function up(type,detail){try{parent.postMessage({type:type,detail:detail},'*')}catch(e){s.textContent='postMessage error: '+e}}
t.addEventListener('pointerdown',function(e){n++;t.textContent='TOUCH ME · '+n;up('touch',e.pointerType+' #'+n)});
var k=document.getElementById('k'),bridged=false;
k.addEventListener('keydown',function(e){if(!bridged)up('key','key '+e.key)});
k.addEventListener('focus',function(){bridged=false;setTimeout(function(){parent.postMessage({type:'kbd-want'},'*')},0)});
k.addEventListener('blur',function(){bridged=true;k.classList.add('on')});
k.addEventListener('pointerdown',function(){k.classList.remove('on')});
window.addEventListener('message',function(e){var d=e.data||{};if(!bridged)return;
 var a=k.selectionStart==null?k.value.length:k.selectionStart,b=k.selectionEnd==null?a:k.selectionEnd;
 if(d.type==='kbd-text'){k.value=k.value.slice(0,a)+d.text+k.value.slice(b);a+=d.text.length;k.setSelectionRange(a,a)}
 else if(d.type==='kbd-key'){if(d.key==='Backspace'&&a>0){k.value=k.value.slice(0,a-1)+k.value.slice(b);k.setSelectionRange(a-1,a-1)}
  else if(d.key==='ArrowLeft'&&a>0)k.setSelectionRange(a-1,a-1);else if(d.key==='ArrowRight')k.setSelectionRange(a+1,a+1);
  else if(d.key==='Enter'){s.textContent='ENTER: '+k.value}}
 else return;parent.postMessage({type:'kbd-got',value:k.value},'*')});
window.addEventListener('message',function(e){var d=e.data||{};if(d.type==='icue'){s.textContent='widget uniqueId: '+d.uniqueId;parent.postMessage({type:'ack',uniqueId:d.uniqueId},'*')}});
up('hello','');
</script></body></html>
'@

$redirect = @'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#080808;color:#f2f0e9;font:24px Consolas,monospace}
body{display:grid;gap:24px;align-content:center;justify-items:center}
b{color:#10b981;font-size:48px;letter-spacing:.12em}
button{font:inherit;height:80px;padding:0 40px;border-radius:999px;border:2px solid #10b981;background:#141414;color:#f2f0e9}
#c{color:#b8b6b0}
</style></head><body>
<b>REDIRECT OK</b>
<div id="c">touches: 0</div>
<button id="back">BACK TO WIDGET</button>
<script>
var n=0,q=new URLSearchParams(location.search),back=q.get('back');
document.addEventListener('pointerdown',function(){n++;document.getElementById('c').textContent='touches: '+n});
document.getElementById('back').addEventListener('click',function(){history.back();setTimeout(function(){if(back)location.href=back},800)});
</script></body></html>
'@

function Send($stream, $status, $type, $text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
}

function Handle($client) {
    try {
        $client.ReceiveTimeout = 3000
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
        $line = $reader.ReadLine()
        if (-not $line) { return }
        $origin = ""
        while ($true) {
            $h = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($h)) { break }
            if ($h -like "Origin:*") { $origin = $h.Substring(7).Trim() }
        }
        $parts = $line.Split(" ")
        $target = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
        $path = $target.Split("?")[0]
        Write-Host ("{0}  {1}  (origin: {2})" -f (Get-Date -Format HH:mm:ss), $line, $origin)
        switch ($path) {
            "/ping"     { Send $stream "200 OK" "application/json" ('{"ok":true,"server":"frametest-ps1","time":"' + (Get-Date -Format o) + '"}') }
            "/frame"    { Send $stream "200 OK" "text/html; charset=utf-8" $frame }
            "/redirect" { Send $stream "200 OK" "text/html; charset=utf-8" $redirect }
            default     { Send $stream "200 OK" "text/plain; charset=utf-8" "Dot Frametest server OK" }
        }
    } catch {
        Write-Host ("Erreur sur une requête : " + $_.Exception.Message) -ForegroundColor Yellow
    } finally {
        $client.Close()
    }
}

try {
    $listeners = @()
    foreach ($ip in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
        try {
            $l = New-Object System.Net.Sockets.TcpListener($ip, $port)
            $l.Start()
            $listeners += $l
        } catch {
            Write-Host ("Impossible d'écouter sur {0}:{1} : {2}" -f $ip, $port, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    if ($listeners.Count -eq 0) { throw "Aucune adresse disponible : le port $port est peut-être déjà utilisé." }
    Write-Host "Dot Frametest : serveur prêt sur http://localhost:$port/  (fermer la fenêtre pour arrêter)" -ForegroundColor Green
    Write-Host "Vérification : ouvre http://localhost:$port/frame dans ton navigateur." -ForegroundColor Green
    while ($true) {
        $idle = $true
        foreach ($l in $listeners) {
            if ($l.Pending()) { $idle = $false; Handle ($l.AcceptTcpClient()) }
        }
        if ($idle) { Start-Sleep -Milliseconds 20 }
    }
} catch {
    Write-Host ""
    Write-Host ("ERREUR : " + $_.Exception.Message) -ForegroundColor Red
    Read-Host "Appuie sur Entrée pour fermer"
}
