param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "Unable to start the local dashboard server on port $Port." -ForegroundColor Red
    Write-Host "Try closing another app using the port, then run start_dashboard.bat again."
    Read-Host "Press Enter to close"
    exit 1
}

Start-Process $Prefix
Write-Host ""
Write-Host "Work2Wish dashboard is running at $Prefix" -ForegroundColor Cyan
Write-Host "The demo video will play inside the dashboard."
Write-Host "Keep this window open. Press Ctrl+C to stop the server."
Write-Host ""

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))

        if ([string]::IsNullOrWhiteSpace($requestPath)) {
            $requestPath = "index.html"
        }

        $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath))
        $rootFull = [System.IO.Path]::GetFullPath($Root)

        if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            $context.Response.StatusCode = 403
            $context.Response.Close()
            continue
        }

        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
        }

        $bytes = [System.IO.File]::ReadAllBytes($candidate)
        $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()

        if ($mimeTypes.ContainsKey($extension)) {
            $context.Response.ContentType = $mimeTypes[$extension]
        } else {
            $context.Response.ContentType = "application/octet-stream"
        }

        $context.Response.StatusCode = 200
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.OutputStream.Close()
    } catch {
        if ($listener.IsListening) {
            Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}
