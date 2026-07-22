#!/usr/bin/env bash
set -uo pipefail
SVC=os
PORT=5002
REPO=/opt/blocks/code/blocks-$SVC
SEC=/opt/blocks/security
SONAR=http://127.0.0.1:9000
DT=http://127.0.0.1:8081
DDH=inception-dast.blocksdevelopers.com
SHIELDH=inception-shield.blocksdevelopers.com
export PATH="$PATH:$HOME/.dotnet/tools"
[ -f /opt/blocks/secrets/scan.env ] && . /opt/blocks/secrets/scan.env

START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FAIL=0
REDACT='s#(squ_[A-Za-z0-9]+|odt_[A-Za-z0-9_-]+|Token [A-Za-z0-9]+|password=[^ &"]*|//[^:@/]+:[^@/]+@)#[redacted]#g'

step(){
  local name="$1"; shift
  local log; log="$(mktemp)"
  if "$@" >"$log" 2>&1; then
    echo "OK   - $name"
  else
    echo "FAIL - $name"
    sed -E "$REDACT" "$log" | tail -20 | sed 's/^/       /'
    FAIL=1
  fi
  rm -f "$log"
}

pull(){ git -C "$REPO" fetch --prune origin inception && git -C "$REPO" checkout -f inception && git -C "$REPO" reset --hard origin/inception; }

secret(){
  trufflehog git "file://$REPO" --json --no-update > "$SEC/secrets/blocks-$SVC.trufflehog.json" 2>/dev/null
  python3 "$SEC/th_transform.py" "$SVC" < "$SEC/secrets/blocks-$SVC.trufflehog.json" > "$SEC/secrets/blocks-$SVC.gh.json"
  curl -fsS -u "$SHIELD_USER:$SHIELD_PASS" -T "$SEC/secrets/blocks-$SVC.gh.json" "https://$SHIELDH/data/blocks-$SVC.trufflehog.json" -o /dev/null
}

sca(){
  trivy fs --quiet --format cyclonedx --output "$SEC/sbom/blocks-$SVC.cdx.json" "$REPO"
  sed -E 's/"specVersion"[[:space:]]*:[[:space:]]*"1\.7"/"specVersion": "1.6"/' "$SEC/sbom/blocks-$SVC.cdx.json" > "$SEC/sbom/blocks-$SVC.16.cdx.json"
  curl -fsS -X POST "$DT/api/v1/bom" -H "X-Api-Key: $DT_API_KEY" -F autoCreate=true -F projectName="blocks-$SVC" -F projectVersion=inception -F "bom=@$SEC/sbom/blocks-$SVC.16.cdx.json" -o /dev/null
}

sast(){
  cd "$REPO"
  dotnet sonarscanner begin /k:"blocks-$SVC" /d:sonar.host.url="$SONAR" /d:sonar.login="$SONAR_TOKEN" /d:sonar.scanner.scanAll=true /d:sonar.exclusions="**/node_modules/**,**/dist/**,**/wwwroot/**,**/bin/**,**/obj/**"
  dotnet build "$(ls server/*.sln server/*.slnx 2>/dev/null | head -1)" -c Release --nologo -v q
  dotnet sonarscanner end /d:sonar.login="$SONAR_TOKEN"
}

dast(){
  mkdir -p "$SEC/dast"; chmod 777 "$SEC/dast"
  docker run --rm -v "$SEC/dast:/zap/wrk:rw" zaproxy/zap-stable zap-baseline.py -t "https://inception-$SVC.blocksdevelopers.com" -x "zap-$SVC.xml" -I
  curl -fsS -X POST "https://$DDH/api/v2/import-scan/" -H "Authorization: Token $DD_TOKEN" -F "scan_type=ZAP Scan" -F "product_type_name=Blocks Inception" -F "product_name=blocks-$SVC" -F "engagement_name=DAST-inception" -F auto_create_context=true -F active=true -F verified=false -F minimum_severity=Info -F "file=@$SEC/dast/zap-$SVC.xml" -o /dev/null
}

deploy(){
  if [ -d "$REPO/client" ]; then ( cd "$REPO/client" && npm ci --no-audit --no-fund && npm run build ); fi
  dotnet publish "$REPO/server/Api/Api.csproj" -c Release -o "$REPO/builds/api" --nologo
  dotnet publish "$REPO/server/Worker/Worker.csproj" -c Release -o "$REPO/builds/worker" --nologo
  systemctl restart "blocks-$SVC-api" "blocks-$SVC-worker"
}

step "pull inception"                     pull
step "secret scan (trufflehog -> shield)" secret
step "sca scan (trivy -> dependency-track)" sca
step "sast scan (sonarqube)"              sast
step "dast scan (zap -> defectdojo)"      dast
step "deploy (build + restart service)"   deploy

END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "--------------------------------------------------"
if [ "$FAIL" -eq 0 ]; then echo "RESULT: SUCCESS - all steps passed"; else echo "RESULT: FAILURE - see FAIL step(s) above"; fi
echo "started: $START"
echo "ended:   $END"
exit "$FAIL"
