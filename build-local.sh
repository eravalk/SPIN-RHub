#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
read -r release_name release_code < <(python3 tools/version.py --values)
python3 tests/check-download-release.py
: "${SPIN_SDK:?Set SPIN_SDK to Android SDK root}"
: "${SPIN_ECJ_JAR:?Set SPIN_ECJ_JAR to Eclipse ECJ 3.38 compiler jar}"
tools="$SPIN_SDK/build-tools/35.0.0"
platform="$SPIN_SDK/platforms/android-35/android.jar"
python3 - <<'PY_CLEAN'
import pathlib,shutil
p=pathlib.Path("build/manual")
if p.exists():shutil.rmtree(p)
PY_CLEAN
mkdir -p build/manual/classes build/manual/generated
python3 - <<'PY'
s=open('app/src/main/AndroidManifest.xml').read().replace('<manifest ','<manifest package="com.spinplayer.app" ',1)
open('build/manual/AndroidManifest.xml','w').write(s)
PY
"$tools/aapt2" compile --dir app/src/main/res -o build/manual/resources.zip
"$tools/aapt2" link -o build/manual/resources.apk -I "$platform" --manifest build/manual/AndroidManifest.xml --java build/manual/generated --min-sdk-version 33 --target-sdk-version 35 --rename-manifest-package com.spinplayer.next --version-code "$release_code" --version-name "$release_name" -A app/src/main/assets build/manual/resources.zip
java -jar "$SPIN_ECJ_JAR" -1.8 -proc:none -warn:none -bootclasspath "$platform:$tools/core-lambda-stubs.jar" -classpath "$(find app/libs -name '*.jar' -printf '%p:')" -d build/manual/classes app/src/main/java/com/spinplayer/app/*.java build/manual/generated/com/spinplayer/app/R.java
python3 - <<'PY'
import zipfile,pathlib
with zipfile.ZipFile('build/manual/classes.jar','w') as z:
 for p in pathlib.Path('build/manual/classes').rglob('*.class'):z.write(p,str(p.relative_to('build/manual/classes')))
PY
"$tools/d8" --lib "$platform" --min-api 33 --output build/manual build/manual/classes.jar app/libs/*.jar
python3 - <<'PY'
import shutil,zipfile
shutil.copy('build/manual/resources.apk','build/manual/unsigned.apk')
from pathlib import Path
with zipfile.ZipFile('build/manual/unsigned.apk','a') as z:
 existing=set(z.namelist())
 for native in Path('app/src/main/jniLibs').rglob('*.so'):z.write(native,'lib/'+str(native.relative_to('app/src/main/jniLibs')))
 for dex in sorted(Path('build/manual').glob('classes*.dex')):z.write(dex,dex.name)
 for jar in sorted(Path('app/libs').glob('*.jar')):
  with zipfile.ZipFile(jar) as lib:
   for name in lib.namelist():
    if name.endswith(('.class','/','.SF','.RSA','.DSA')) or name=='META-INF/MANIFEST.MF':continue
    if name in existing:continue
    z.writestr(name,lib.read(name));existing.add(name)
PY
if [ ! -f signing/spin-next.keystore ]; then
 "$tools/zipalign" -f -p 4 build/manual/unsigned.apk "SPIN-RHub-$release_name-unsigned.apk"
 echo 'Unsigned build ready. signing/spin-next.keystore is required to sign this new application.'
 exit 0
fi
"$tools/zipalign" -f -p 4 build/manual/unsigned.apk build/manual/aligned.apk
"$tools/apksigner" sign --ks signing/spin-next.keystore --ks-key-alias spin-next --ks-pass file:signing/password.txt --out "SPIN-RHub-$release_name.apk" build/manual/aligned.apk
"$tools/apksigner" verify --verbose "SPIN-RHub-$release_name.apk"
