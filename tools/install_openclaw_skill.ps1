param(
  [string]$ContainerId = "8033816feb5b1433e8fe4332a3473ad4c200a5a47ce0bff3751b4bca51878dea",
  [string]$SkillName = "qq-english-learning-loop"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localSkillDir = Join-Path $projectRoot "openclaw-skills\$SkillName"

if (!(Test-Path $localSkillDir)) {
  throw "Skill directory not found: $localSkillDir"
}

$targetDir = "/root/.openclaw/workspace/skills/$SkillName"

Write-Host "Installing skill '$SkillName' into container $ContainerId ..."
docker exec $ContainerId sh -lc "rm -rf $targetDir && mkdir -p $targetDir"
docker cp "$localSkillDir/." "${ContainerId}:$targetDir"
docker exec $ContainerId sh -lc "chmod +x $targetDir/scripts/*.sh 2>/dev/null || true"

Write-Host "Installed to $targetDir"
Write-Host "Verifying..."
$verifyCmd = "PATH=/root/.nvm/versions/node/v22.22.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; if openclaw skills list 2>&1 | grep -F '$SkillName' >/dev/null; then echo 'Verified: $SkillName'; else echo 'Warning: $SkillName not found in openclaw skills list.'; fi"
docker exec $ContainerId sh -lc $verifyCmd
