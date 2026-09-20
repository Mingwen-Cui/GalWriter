/** Optional Windows launcher for browsers that restrict file:// resources. */
export const LOCAL_PREVIEW_CMD =
  '@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0preview-server.ps1"\r\nif errorlevel 1 pause\r\n';

export const LOCAL_PREVIEW_SERVER = String.raw`param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$previewRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$previewPrefix = $previewRoot.TrimEnd('\') + '\'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.wasm' = 'application/wasm'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'; '.gif' = 'image/gif'; '.avif' = 'image/avif'; '.ico' = 'image/x-icon'
  '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.ogg' = 'audio/ogg'; '.m4a' = 'audio/mp4'
  '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.ogv' = 'video/ogg'; '.mov' = 'video/quicktime'
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'; '.otf' = 'font/otf'
}
function Write-Headers($stream, $status, $mime, [long]$length, $extra = '') {
  $header = "HTTP/1.1 $status" + [char]13 + [char]10 +
    "Content-Type: $mime" + [char]13 + [char]10 +
    "Content-Length: $length" + [char]13 + [char]10 +
    "Connection: close" + [char]13 + [char]10 +
    "Cache-Control: no-store" + [char]13 + [char]10 +
    "X-Content-Type-Options: nosniff" + [char]13 + [char]10 +
    $extra + [char]13 + [char]10
  $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($bytes, 0, $bytes.Length)
}
try {
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $address = "http://127.0.0.1:$port/index.html"
  Write-Output "GalWriter local preview: $address"
  Write-Output 'Keep this window open while playing. Close it to stop the preview.'
  if (-not $NoBrowser) { Start-Process $address }
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $file = $null
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 3000
      $stream.WriteTimeout = 10000
      # Read only the request headers. Limit incomplete or oversized requests.
      $headerBytes = [System.Collections.Generic.List[byte]]::new()
      $matched = 0
      $end = @(13, 10, 13, 10)
      while ($headerBytes.Count -lt 16384 -and $matched -lt 4) {
        $value = $stream.ReadByte()
        if ($value -lt 0) { break }
        $headerBytes.Add([byte]$value)
        if ($value -eq $end[$matched]) { $matched++ } else { $matched = 0 }
      }
      if ($matched -ne 4) { continue }
      $request = [System.Text.Encoding]::ASCII.GetString($headerBytes.ToArray())
      $lines = $request -split "\r\n"
      $parts = $lines[0] -split ' '
      if ($parts.Length -ne 3 -or $parts[0] -notin @('GET', 'HEAD')) {
        Write-Headers $stream '405 Method Not Allowed' 'text/plain' 0
        continue
      }
      $headers = @{}
      foreach ($line in $lines | Select-Object -Skip 1) {
        $colon = $line.IndexOf(':')
        if ($colon -gt 0) { $headers[$line.Substring(0, $colon).ToLowerInvariant()] = $line.Substring($colon + 1).Trim() }
      }
      if ($headers['host'] -ne "127.0.0.1:$port") {
        Write-Headers $stream '403 Forbidden' 'text/plain' 0
        continue
      }
      $path = [System.Uri]::UnescapeDataString(($parts[1] -split '\?', 2)[0])
      if (-not $path.StartsWith('/') -or $path.Contains(':')) {
        Write-Headers $stream '400 Bad Request' 'text/plain' 0
        continue
      }
      if ($path -eq '/') { $path = '/index.html' }
      $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($previewRoot, $path.TrimStart('/').Replace('/', '\')))
      if (-not $filePath.StartsWith($previewPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($filePath)) {
        Write-Headers $stream '404 Not Found' 'text/plain' 0
        continue
      }
      $file = [System.IO.File]::OpenRead($filePath)
      [long]$start = 0
      [long]$finish = $file.Length - 1
      $status = '200 OK'
      $extra = "Accept-Ranges: bytes" + [char]13 + [char]10
      # Byte ranges let browsers seek exported audio/video without reading it all.
      if ($headers['range'] -match '^bytes=(\d*)-(\d*)$' -and $file.Length -gt 0) {
        if ($Matches[1]) {
          $start = [long]$Matches[1]
          if ($Matches[2]) { $finish = [Math]::Min($finish, [long]$Matches[2]) }
        } elseif ($Matches[2]) {
          $start = [Math]::Max(0, $file.Length - [long]$Matches[2])
        }
        if ($start -gt $finish) {
          Write-Headers $stream '416 Range Not Satisfiable' 'text/plain' 0 ("Content-Range: bytes */" + $file.Length + [char]13 + [char]10)
          continue
        }
        $status = '206 Partial Content'
        $extra += "Content-Range: bytes $start-$finish/" + $file.Length + [char]13 + [char]10
      }
      $mime = $mimeTypes[[System.IO.Path]::GetExtension($filePath).ToLowerInvariant()]
      if (-not $mime) { $mime = 'application/octet-stream' }
      $remaining = $finish - $start + 1
      Write-Headers $stream $status $mime $remaining $extra
      if ($parts[0] -eq 'HEAD') { continue }
      $file.Position = $start
      $buffer = New-Object byte[] 65536
      while ($remaining -gt 0) {
        $count = $file.Read($buffer, 0, [int][Math]::Min($buffer.Length, $remaining))
        if ($count -le 0) { break }
        $stream.Write($buffer, 0, $count)
        $remaining -= $count
      }
    } catch {
      # Browsers may cancel requests when navigating or seeking media.
    } finally {
      if ($file) { $file.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
`;
