# Preview signing key

`preview.keystore` is the key every **BuildPlan Model Preview** APK is signed
with, on every machine and on every CI run. It is committed on purpose, and
its password is written here on purpose.

| | |
| --- | --- |
| File | `apps/android/keystore/preview.keystore` (PKCS12) |
| Key alias | `buildplan-preview` |
| Store password | `buildplan-preview` |
| Key password | `buildplan-preview` (PKCS12 stores use one password for both) |
| Certificate | `CN=BuildPlan Model Preview, OU=Preview builds (not a production key), O=BuildApp` |
| Signer SHA-256 | `6E:48:FA:C4:AF:AA:3D:70:E7:0D:E5:BC:60:8A:A4:C4:19:42:06:A9:E6:BC:99:3D:AB:56:38:2B:92:1C:A0:DA` |
| Algorithm | RSA 2048, SHA256withRSA, self-signed, valid until 2054 |

## Why it is public, and what it does not grant

This is a **preview / debug identity, not a production secret.** It exists for
one reason: Android only installs an APK as an *update* of the app already on
the phone when both are signed by the same certificate. A CI runner's
auto-generated `~/.android/debug.keystore` is a new key on every run, which is
why new CI APKs used to be refused with a signature mismatch. One committed key
makes every build — CI or local — update the previous one.

The key is only ever used for `com.buildplan.preview`, the sideloaded viewer.
Holding it grants nothing:

- it is not, and must never become, the key of a Play Store listing or of any
  other app id (the older `com.buildplan.app` prototype has its own);
- the preview has no permissions, no network, no stored data and no exported
  components, so an APK signed with this key can neither read the phone nor
  talk to anything;
- no service, API, certificate pinning or update channel trusts it.

Anyone who can build the repository can already produce an APK with this app
id; the key changes only whether that APK *replaces* an installed preview.
Treat it like the well-known Android debug key, which is exactly what it stands
in for.

## Overriding it (CI secrets or a private key)

`app/build.gradle.kts` reads four environment variables; blank or unset means
"use the committed key":

| Variable | Meaning |
| --- | --- |
| `BUILDPLAN_PREVIEW_KEYSTORE` | path to a PKCS12 or JKS keystore |
| `BUILDPLAN_PREVIEW_KEYSTORE_PASSWORD` | its store password |
| `BUILDPLAN_PREVIEW_KEY_ALIAS` | the key alias |
| `BUILDPLAN_PREVIEW_KEY_PASSWORD` | the key password (defaults to the store password) |

The Android job in `.github/workflows/buildapp-ci.yml` already maps these from
repository secrets of the same names (the keystore itself as
`BUILDPLAN_PREVIEW_KEYSTORE_BASE64`), so switching to a private key is a
matter of defining the secrets, with no workflow or Gradle change. A different
key means one more uninstall on every phone that has the preview installed.

## Regenerating it

Only do this if the key must be rotated. Every phone with the preview installed
will have to uninstall it once afterwards. The command that produced the
current file:

```bash
keytool -genkeypair -v \
  -keystore apps/android/keystore/preview.keystore \
  -storetype PKCS12 \
  -storepass buildplan-preview -keypass buildplan-preview \
  -alias buildplan-preview \
  -keyalg RSA -keysize 2048 -sigalg SHA256withRSA \
  -validity 10000 \
  -dname "CN=BuildPlan Model Preview, OU=Preview builds (not a production key), O=BuildApp"
```

Then update the fingerprint in this file and in `docs/ANDROID_MODEL_PREVIEW.md`:

```bash
keytool -list -v -keystore apps/android/keystore/preview.keystore -storepass buildplan-preview | grep SHA256
```

## Checking what signed an APK

```bash
apps/android/tools/verify-preview-signature.sh            # every APK under app/build/preview-apks
apps/android/tools/verify-preview-signature.sh some.apk   # a downloaded one
```

It compares the certificate `apksigner` reads out of the APK with the one in
the keystore (the committed one, or the `BUILDPLAN_PREVIEW_*` override). The
APKs carry only an APK Signature Scheme v2 signature (minSdk 26 needs no v1
JAR signature), so `keytool -printcert -jarfile` shows nothing; use
`apksigner verify --print-certs` from the SDK build-tools.
