[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$repository = 'https://github.com/happyivanencoding/wanxian.git'
$publish = Join-Path $root '.artifacts\pages-publish'
$site = Join-Path $root '.artifacts\pages-site'

Set-Location $root
if ((git status --porcelain)) { throw 'Commit the verified source changes before publishing.' }
$revision = (git rev-parse HEAD).Trim()
& npm.cmd run build:pages
if ($LASTEXITCODE -ne 0) { throw 'The production build failed.' }
[IO.File]::WriteAllText((Join-Path $site '.nojekyll'), '')

if (-not (Test-Path (Join-Path $publish '.git'))) {
  $branch = git ls-remote --heads origin gh-pages
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read the deployment branch.' }
  if ($branch) {
    git clone --single-branch --branch gh-pages $repository $publish
  } else {
    New-Item -ItemType Directory -Force $publish | Out-Null
    git -C $publish init -b gh-pages
    git -C $publish remote add origin $repository
  }
  if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare the deployment checkout.' }
} else {
  $origin = (git -C $publish remote get-url origin).Trim()
  if ($origin -ne $repository) { throw 'Unexpected deployment repository.' }
  git -C $publish pull --ff-only origin gh-pages
  if ($LASTEXITCODE -ne 0) { throw 'The deployment branch needs reconciliation.' }
}

$name = (git config user.name).Trim()
$email = (git config user.email).Trim()
git -C $publish config user.name $name
git -C $publish config user.email $email
Get-ChildItem -LiteralPath $publish -Force | Where-Object Name -ne '.git' | Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath $site -Force | Copy-Item -Destination $publish -Recurse -Force
git -C $publish add --all
if ((git -C $publish status --porcelain)) {
  git -C $publish commit -m "Publish life simulator $revision"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot commit the deployment snapshot.' }
}
git -C $publish push origin HEAD:gh-pages
if ($LASTEXITCODE -ne 0) { throw 'The deployment push failed.' }
Write-Output "Source revision: $revision"
Write-Output 'Site: https://happyivanencoding.github.io/wanxian/'
Write-Output 'Verify the Pages build and public browser before reporting deployment complete.'
