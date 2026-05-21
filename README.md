> [!NOTE
> This plugin is a fork and rewrite of [Stefan Cruz's plugin](https://stefancruz.github.io/grayjay-plugin-preservetube), with features added such as redirection to preserved videos, channel separation and web scraping. By default the plugin only handles YouTube URLs if there is an archived version and if not then it doesn't claim the URL causing the videos to fallback to the YouTube version, this behavior can be changed in the settings but it's recommended to keep it disabled as PreserveTube asks users to only archive videos worth archiving long term. It is recommended to put this plugin over the YouTube plugin in the sources area for the best experience, in the future this will be expanded if Polycentric is opened to combining video sources directly.

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

### Contributions
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.

### Signing
```bash
# This code is designed to be run in VSCode's terminal on Linux
# Generate keypair
ssh-keygen -t rsa -b 2048 -m PEM -f ./private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./private-key.pem)"

# Run the sign script:
sh ./sign-script.sh ./PreserveTubeScript.js ./PreserveTubeConfig.json
```
