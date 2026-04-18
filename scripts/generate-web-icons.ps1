Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Join-Path $PSScriptRoot ".."
$iconDir = Join-Path $repoRoot "assets\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
$sourceIconPath = Join-Path $iconDir "new_icon.jpg"

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

function Get-AdjustedToneColor([System.Drawing.Color]$pixel) {
  $luma = (0.2126 * $pixel.R) + (0.7152 * $pixel.G) + (0.0722 * $pixel.B)
  if($luma -lt 70) {
    $factor = 0.68
  } elseif($luma -lt 120) {
    $factor = 0.8
  } else {
    $factor = 0.96
  }

  $r = [Math]::Max(0, [Math]::Min(255, [Math]::Round(($pixel.R - 128) * 1.06 + 128)))
  $g = [Math]::Max(0, [Math]::Min(255, [Math]::Round(($pixel.G - 128) * 1.06 + 128)))
  $b = [Math]::Max(0, [Math]::Min(255, [Math]::Round(($pixel.B - 128) * 1.06 + 128)))

  return New-Color `
    ([Math]::Max(0, [Math]::Min(255, [Math]::Round($r * $factor)))) `
    ([Math]::Max(0, [Math]::Min(255, [Math]::Round($g * $factor)))) `
    ([Math]::Max(0, [Math]::Min(255, [Math]::Round($b * $factor)))) `
    $pixel.A
}

function Draw-GhostIconFromSource([int]$size, [string]$path, [string]$sourcePath) {
  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $sourceSize = [Math]::Min($source.Width, $source.Height)
  $srcX = [int](($source.Width - $sourceSize) / 2)
  $srcY = [int](($source.Height - $sourceSize) / 2)
  $srcRect = [System.Drawing.Rectangle]::new($srcX, $srcY, $sourceSize, $sourceSize)
  $destRect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
  $g.Clear((New-Color 5 5 8))
  $g.DrawImage($source, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $g.Dispose()
  $source.Dispose()

  for($x = 0; $x -lt $bmp.Width; $x++) {
    for($y = 0; $y -lt $bmp.Height; $y++) {
      $bmp.SetPixel($x, $y, (Get-AdjustedToneColor $bmp.GetPixel($x, $y)))
    }
  }

  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgRect = [System.Drawing.RectangleF]::new(0, 0, $size, $size)
  $bgTop = New-Color 4 4 6 0
  $bgBottom = New-Color 8 10 16 82
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bgRect, $bgTop, $bgBottom, 90)
  $g.FillRectangle($bgBrush, $bgRect)
  $bgBrush.Dispose()
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
  if(Test-Path $sourceIconPath) {
    Draw-GhostIconFromSource -size $output.Size -path $output.Path -sourcePath $sourceIconPath
  } else {
    throw "Missing source icon screenshot: $sourceIconPath"
  }
}

Write-Host "Generated web app icons in $iconDir" -ForegroundColor Green
