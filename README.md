> [!NOTE]
> This plugin is a fork and rewrite of [Stefan Cruz's plugin](https://stefancruz.github.io/grayjay-plugin-preservetube).
> By default the plugin will redirect YouTube URLs if there is an archived version available so you are able to put the plugin over the YouTube plugin so it takes priority, this plugin also supports archiving unarchived videos but is disabled by default to prevent abuse.

### Grayjay PreserveTube
This plugin adds support for the platform [PreserveTube](https://preservetube.com/), allowing you to view archived YouTube videos in Grayjay.

### Installation
You can install the plugin by scanning this QR code:  
![QR Code](https://raw.githubusercontent.com/b-risk/grayjay-plugin-preservetube/refs/heads/master/Imgs/qr-code.png)

Alternatively, you can add it manually by using this link:
```
grayjay://plugin/https://raw.githubusercontent.com/b-risk/grayjay-plugin-preservetube/refs/heads/master/PreserveTubeConfig.json
```

### Features
- [x] Home feed (latest archived videos)
- [x] Video playback & metadata, videos use the same ID so the Polycentric comment section is the same
- [x] Channel pages with video listings
- [x] Search
- [x] Channel search, parses videos for creator names as PreserveTube doesn't support channel searching
- [x] YouTube fallback and video URL support
- [x] YouTube channel separation (can be disabled in settings)
- [x] Archiving prompt for unarchived YouTube videos (optional, off by default)
- [x] Retry logic with toast notifications when PreserveTube is unresponsive

### Signing
```bash
# Linux commands (may generate different keys depending on the platform)
# Generate keypair
mkdir -p ./Signatures
ssh-keygen -t rsa -b 2048 -m PEM -f ./Signatures/private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./Signatures/private-key.pem)"

# Run the sign script:
sh ./sign-script.sh ./PreserveTubeScript.js ./PreserveTubeConfig.json
```

### Contributions & AI Disclosure
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.
LLM assisted code is responsibly used during development, code is vetted manually for quality.