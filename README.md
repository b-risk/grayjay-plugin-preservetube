### Grayjay PreserveTube
This plugin adds support for the platform [PreserveTube](https://preservetube.com/), allowing you to view archived YouTube videos in Grayjay.
This plugin is a fork of [Stefan Cruz's plugin](https://stefancruz.github.io/grayjay-plugin-preservetube).

### Installation
You can install the plugin by scanning this QR code:  
![QR Code](https://raw.githubusercontent.com/b-risk/grayjay-plugin-preservetube/refs/heads/main/Imgs/qr-code.png)

Alternatively, you can add it manually by using this link:
```
grayjay://plugin/https://raw.githubusercontent.com/b-risk/grayjay-plugin-preservetube/refs/heads/master/PreserveTubeConfig.json
```

### Features
- [x] Home feed (latest archived videos)
- [x] Video playback from PreserveTube
- [x] Channel pages with video listings
- [x] Search
- [x] YouTube video URL support — always checks PreserveTube first for archived copy; redirects to YouTube plugin if not found
- [x] YouTube channel separation (can be disabled in settings)
- [x] Archiving prompt for unarchived YouTube videos (optional, off by default)
- [x] Retry logic with toast notifications when PreserveTube is unresponsive
- [x] Graceful fallback to YouTube when PreserveTube is unavailable

### Contributions
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.

### Signing
```bash
# Generate keypair
ssh-keygen -t rsa -b 2048 -m PEM -f ./private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./private-key.pem)"

# Run the sign script (use git bash on Windows):
sh ./sign-script.sh ./PreserveTubeScript.js ./PreserveTubeConfig.json
```
