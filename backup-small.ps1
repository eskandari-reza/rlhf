$src   = "D:\02_Projects\rlhf"
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$tmp   = Join-Path $env:TEMP "rlhf-small-$stamp"
$dst   = "D:\02_Projects\rlhf-small-$stamp.zip"

# کپی فقط فایل‌های اصلی (بدون پوشه‌ها و فایل‌های قابل بازسازی)
robocopy $src $tmp /E `
  /XD node_modules .next dist .turbo .git .vscode coverage `
  /XF *.tsbuildinfo *.log Screenshot*.png `
  /NFL /NDL /NJH /NJS | Out-Null

# فشرده‌سازی
Compress-Archive -Path "$tmp\*" -DestinationPath $dst -Force
Remove-Item $tmp -Recurse -Force

$mb = "{0:N2}" -f ((Get-Item $dst).Length / 1MB)
Write-Host "Backup saved: $dst ($mb MB)"