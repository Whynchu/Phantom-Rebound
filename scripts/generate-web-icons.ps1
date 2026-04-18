Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Join-Path $PSScriptRoot ".."
$iconDir = Join-Path $repoRoot "assets\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function New-Color([int]$r, [int]$g, [int]$b, [int]$a = 255) {
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function Mix-Color([System.Drawing.Color]$from, [System.Drawing.Color]$to, [double]$amount) {
  $mix = {
    param([int]$a, [int]$b, [double]$t)
    return [Math]::Round($a + ($b - $a) * $t)
  }
  return New-Color `
    (& $mix $from.R $to.R $amount) `
    (& $mix $from.G $to.G $amount) `
    (& $mix $from.B $to.B $amount) `
    (& $mix $from.A $to.A $amount)
}

function Draw-GhostIcon([int]$size, [string]$path) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgRect = [System.Drawing.RectangleF]::new(0, 0, $size, $size)
  $bgTop = New-Color 5 5 8
  $bgBottom = New-Color 18 24 38
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bgRect, $bgTop, $bgBottom, 90)
  $g.FillRectangle($bgBrush, $bgRect)
  $bgBrush.Dispose()

  $ghostAccent = New-Color 74 222 128
  $ghostLight = New-Color 184 255 204
  $ghostBody = Mix-Color (New-Color 247 251 255) $ghostAccent 0.18
  $ghostOutline = Mix-Color $ghostLight $ghostBody 0.42

  $cx = $size / 2.0
  $cy = $size * 0.56
  $radius = $size * 0.19

  $haloPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $haloRect = [System.Drawing.RectangleF]::new($cx - $radius * 2.8, $cy - $radius * 2.95, $radius * 5.6, $radius * 5.6)
  $haloPath.AddEllipse($haloRect)
  $haloBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($haloPath)
  $haloBrush.CenterPoint = [System.Drawing.PointF]::new($cx, $cy - $radius * 0.2)
  $haloBrush.CenterColor = New-Color $ghostLight.R $ghostLight.G $ghostLight.B 72
  $haloBrush.SurroundColors = [System.Drawing.Color[]]@((New-Color $ghostLight.R $ghostLight.G $ghostLight.B 0))
  $g.FillEllipse($haloBrush, $haloRect)
  $haloBrush.Dispose()
  $haloPath.Dispose()

  $ghostPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $ghostPath.StartFigure()
  $ghostPath.AddArc($cx - $radius, $cy - $radius * 1.2, $radius * 2, $radius * 2, 180, 180)
  $tailPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx + $radius,         $cy + $radius * 0.78),
    [System.Drawing.PointF]::new($cx + $radius * 0.52,  $cy + $radius * 1.08),
    [System.Drawing.PointF]::new($cx + $radius * 0.14,  $cy + $radius * 0.74),
    [System.Drawing.PointF]::new($cx - $radius * 0.18,  $cy + $radius * 1.12),
    [System.Drawing.PointF]::new($cx - $radius * 0.44,  $cy + $radius * 0.72),
    [System.Drawing.PointF]::new($cx - $radius * 0.74,  $cy + $radius * 1.02),
    [System.Drawing.PointF]::new($cx - $radius,         $cy + $radius * 0.8)
  )
  $ghostPath.AddLines($tailPoints)
  $ghostPath.CloseFigure()

  $bodyBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($ghostPath)
  $bodyBrush.CenterPoint = [System.Drawing.PointF]::new($cx, $cy - $radius * 0.45)
  $bodyBrush.CenterColor = New-Color $ghostBody.R $ghostBody.G $ghostBody.B 245
  $bodyBrush.SurroundColors = [System.Drawing.Color[]]@((New-Color $ghostAccent.R $ghostAccent.G $ghostAccent.B 236))
  $g.FillPath($bodyBrush, $ghostPath)
  $bodyBrush.Dispose()

  $outlinePen = [System.Drawing.Pen]::new((New-Color $ghostOutline.R $ghostOutline.G $ghostOutline.B 210), [Math]::Max(2, $size * 0.016))
  $g.DrawPath($outlinePen, $ghostPath)
  $outlinePen.Dispose()

  $eyeBrush = [System.Drawing.SolidBrush]::new((New-Color 8 15 12 214))
  $eyeR = [Math]::Max(2, $size * 0.025)
  $g.FillEllipse($eyeBrush, $cx - $radius * 0.34 - $eyeR, $cy - $radius * 0.34 - $eyeR, $eyeR * 2, $eyeR * 2)
  $g.FillEllipse($eyeBrush, $cx + $radius * 0.34 - $eyeR, $cy - $radius * 0.34 - $eyeR, $eyeR * 2, $eyeR * 2)
  $eyeBrush.Dispose()

  $mouthPen = [System.Drawing.Pen]::new((New-Color 12 20 16 180), [Math]::Max(1.6, $size * 0.012))
  $g.DrawArc($mouthPen, $cx - $radius * 0.23, $cy - $radius * 0.06, $radius * 0.46, $radius * 0.34, 18, 144)
  $mouthPen.Dispose()

  $sparkBrush = [System.Drawing.SolidBrush]::new((New-Color $ghostAccent.R $ghostAccent.G $ghostAccent.B 205))
  $sparkR = [Math]::Max(1.5, $size * 0.014)
  $g.FillEllipse($sparkBrush, $cx + $radius * 1.28, $cy - $radius * 1.42, $sparkR * 2, $sparkR * 2)
  $g.FillEllipse($sparkBrush, $cx - $radius * 1.62, $cy + $radius * 0.6, $sparkR * 1.8, $sparkR * 1.8)
  $sparkBrush.Dispose()

  $ghostPath.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$outputs = @(
  @{ Size = 32;  Path = (Join-Path $iconDir "favicon-32.png") },
  @{ Size = 180; Path = (Join-Path $iconDir "apple-touch-icon.png") },
  @{ Size = 192; Path = (Join-Path $iconDir "icon-192.png") },
  @{ Size = 512; Path = (Join-Path $iconDir "icon-512.png") }
)

foreach($output in $outputs) {
  Draw-GhostIcon -size $output.Size -path $output.Path
}

Write-Host "Generated web app icons in $iconDir" -ForegroundColor Green
