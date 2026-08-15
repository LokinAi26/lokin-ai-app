# LOKIN Production Apple Association

## Production domain
`https://lokin-ai-app-604c3139.base44.app`

## Associated Domains entitlement
Use this exact entitlement entry in the real iOS app target:

`applinks:lokin-ai-app-604c3139.base44.app`

Do not include a path, query, scheme, or trailing slash in the entitlement value.

## Universal Link command ingress
Production command URLs use:

`https://lokin-ai-app-604c3139.base44.app/command?command=<id>&source=<approved-source>&v=1`

The Base44/web layer performs fail-closed validation before dispatching a command.

## AASA location
Apple expects the association file at:

`https://lokin-ai-app-604c3139.base44.app/.well-known/apple-app-site-association`

Current observed Base44 response (before native identity is configured):

`{"applinks":{"apps":[],"details":[]}}`

That response is valid JSON but it does not associate any iOS app yet. It must ultimately contain the actual Apple application identifier, formed from the Team ID and Bundle ID, plus the permitted `/command` components.

## Base44 iOS identity
Base44 documents its generated package name as:

`com.base6a7a1c830b6bae64604c3139.app`

Confirm the final Bundle ID shown by the generated App Store build before publishing the production AASA. Do not assume or overwrite a pre-existing App Store Bundle ID.

## Native limitation
Base44's current mobile publishing flow generates an App Store-ready IPA around the hosted web app. Base44 documentation describes this as a lightweight native wrapper and does not currently promise an exportable Xcode source project or arbitrary native-only capabilities. Therefore App Intents, Associated Domains entitlement changes, and the Swift validator require either:

1. Base44 adding/supporting those native capabilities in its generated shell, or
2. a separately controlled native iOS wrapper/Xcode project that loads the LOKIN production app and owns the same Bundle ID/signing lineage.

Do not claim the native App Intents bridge is active until it is compiled into the signed iOS target.

## Production verification checklist
1. Confirm Team ID and final Bundle ID.
2. Ensure AASA contains `<TEAM_ID>.<BUNDLE_ID>` and only the intended `/command` rules.
3. Confirm the AASA endpoint returns HTTP 200 over HTTPS, without redirects.
4. Confirm Content-Type is suitable for JSON.
5. Add `applinks:lokin-ai-app-604c3139.base44.app` to the signed iOS target.
6. Install a development-signed build on an iPhone with Developer Mode enabled.
7. Test full production command URLs in Settings > Developer > Universal Links > Diagnostics.
8. On macOS, inspect the endpoint with `curl -v` and use Apple's Shared Web Credentials/Associated Domains tooling available in the installed OS/Xcode toolchain to inspect association state.
9. Test cold launch, warm launch, duplicate/replay behavior, malformed URLs, wrong host, wrong path, wrong source, wrong version, and confirmation-gated commands.
10. Re-run the LOKIN universal-link security corpus before every native release.
