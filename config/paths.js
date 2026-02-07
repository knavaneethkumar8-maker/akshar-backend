const binaryPaths = {
  local_ffmpegPath : "/opt/homebrew/bin/ffmpeg",
  local_soxPath : "/opt/homebrew/bin/sox",
  server_ffmpegPath : "/usr/bin/ffmpeg",
  server_soxPath : "/usr/bin/sox"
}

const runallPaths = {
  server : "http://127.0.0.1:8001/runall",
  local : "http://127.0.0.1:8000/runall"
}

const wav2tgOrigin = {
  local : "http://127.0.0.1:8002",
  server : "https://api.xn--l2bot2c0c.com"
}

module.exports = {binaryPaths, runallPaths, wav2tgOrigin};