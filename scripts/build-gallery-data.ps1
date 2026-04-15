param(
    [string]$GalleryRoot = "assets/gallery",
    [string]$OutputFile = "js/gallery-data.js"
)

$ErrorActionPreference = "Stop"

$monthNames = @{
    "01" = "Januar"
    "02" = "Februar"
    "03" = "Maerz"
    "04" = "April"
    "05" = "Mai"
    "06" = "Juni"
    "07" = "Juli"
    "08" = "August"
    "09" = "September"
    "10" = "Oktober"
    "11" = "November"
    "12" = "Dezember"
}

$imageExtensions = @(".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")
$videoExtensions = @(".mp4", ".webm", ".mov", ".m4v")

$projectRoot = Split-Path -Parent $PSScriptRoot
$galleryPath = Join-Path $projectRoot $GalleryRoot
$outputPath = Join-Path $projectRoot $OutputFile

if (-not (Test-Path $galleryPath)) {
    throw "Der Galerie-Ordner '$galleryPath' existiert nicht."
}

$monthFolders = Get-ChildItem -Path $galleryPath -Directory |
    Where-Object { $_.Name -match '^\d{4}-\d{2}$' } |
    Sort-Object Name

$months = @()
$itemsByMonth = [ordered]@{}

foreach ($folder in $monthFolders) {
    $year, $monthNumber = $folder.Name.Split("-")
    $monthLabel = "$($monthNames[$monthNumber]) $year"

    $months += [ordered]@{
        id = $folder.Name
        label = $monthLabel
    }

    $items = @()

    $mediaFiles = Get-ChildItem -Path $folder.FullName -File -Recurse | Sort-Object FullName

    foreach ($mediaFile in $mediaFiles) {
        $extension = $mediaFile.Extension.ToLowerInvariant()

        if ($imageExtensions -contains $extension -or $videoExtensions -contains $extension) {
            $relativePath = $mediaFile.FullName.Substring($galleryPath.Length + 1) -replace "\\", "/"
            $relativePath = "assets/gallery/$relativePath"
            $caption = [System.IO.Path]::GetFileNameWithoutExtension($mediaFile.Name) -replace "[_-]+", " "
            $type = if ($videoExtensions -contains $extension) { "video" } else { "image" }

            $items += [ordered]@{
                type = $type
                src = $relativePath
                alt = $caption
                caption = $caption
            }
        }
    }

    $itemsByMonth[$folder.Name] = $items
}

$lines = @()
$lines += "window.galleryData = {"
$lines += "  months: ["

for ($i = 0; $i -lt $months.Count; $i++) {
    $month = $months[$i]
    $suffix = if ($i -lt $months.Count - 1) { "," } else { "" }
    $lines += "    { id: `"$($month.id)`", label: `"$($month.label)`" }$suffix"
}

$lines += "  ],"
$lines += "  items: {"

$monthKeys = @($itemsByMonth.Keys)
for ($monthIndex = 0; $monthIndex -lt $monthKeys.Count; $monthIndex++) {
    $monthKey = $monthKeys[$monthIndex]
    $monthSuffix = if ($monthIndex -lt $monthKeys.Count - 1) { "," } else { "" }
    $lines += "    `"$monthKey`": ["

    $items = $itemsByMonth[$monthKey]
    for ($itemIndex = 0; $itemIndex -lt $items.Count; $itemIndex++) {
        $item = $items[$itemIndex]
        $itemSuffix = if ($itemIndex -lt $items.Count - 1) { "," } else { "" }
        $lines += "      { type: `"$($item.type)`", src: `"$($item.src)`", alt: `"$($item.alt)`", caption: `"$($item.caption)`" }$itemSuffix"
    }

    $lines += "    ]$monthSuffix"
}

$lines += "  }"
$lines += "};"

Set-Content -Path $outputPath -Value $lines -Encoding UTF8
Write-Host "Galerie-Manifest erstellt: $outputPath"