#!/bin/bash
# Assemble AgentBoard demo video from real screenshots + cards + voiceover.
set -e
cd ~/workspace/programmer/binance-agent-id/demo
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
FPS=30

scene() { # $1=img $2=vo(mp3 or silent) $3=dur $4=padcolor $5=caption $6=out
  local IMG=$1 VO=$2 DUR=$3 PAD=$4 CAP=$5 OUT=$6
  local DT="drawtext=fontfile=$FONT:text='$CAP':fontsize=28:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=h-64"
  if [ "$VO" = "silent" ]; then
    ffmpeg -y -v error -loop 1 -t "$DUR" -i "$IMG" -f lavfi -t "$DUR" -i anullsrc=r=44100:cl=stereo \
      -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:$PAD,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=$(awk "BEGIN{print $DUR-0.4}"):d=0.4,$DT[v]" \
      -map "[v]" -map 1:a -c:v libx264 -r $FPS -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "$OUT"
  else
    ffmpeg -y -v error -loop 1 -t "$DUR" -i "$IMG" -i "$VO" \
      -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:$PAD,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=$(awk "BEGIN{print $DUR-0.4}"):d=0.4,$DT[v];[1:a]adelay=600|600,apad,atrim=0:$DUR[a]" \
      -map "[v]" -map "[a]" -c:v libx264 -r $FPS -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "$OUT"
  fi
  echo "built $OUT"
}

scene card-title.png vo1.mp3 6.3   0x0D1B3E "AgentBoard - micro-task escrow for Agent ID holders" seg1.mp4
scene shot-home.png  vo2.mp3 12.9  white    "Live product - nurhidayat1234.github.io/agentboard" seg2.mp4
scene shot-how.png   vo3.mp3 17.6  white    "Create a task - lock the reward in escrow" seg3.mp4
scene shot-home.png  vo4.mp3 7.8   white    "No QR login. No server sessions." seg4.mp4
scene card-proof.png vo5.mp3 12.6  0x0D1B3E "Live on BNB Chain mainnet - source verified" seg5.mp4
scene shot-repo.png  silent  4.0   white    "Open source - github.com/nurhidayat1234/agentboard" seg6.mp4
scene card-close.png vo6.mp3 6.1   0x0D1B3E "AgentBoard" seg7.mp4

printf "file 'seg1.mp4'\nfile 'seg2.mp4'\nfile 'seg3.mp4'\nfile 'seg4.mp4'\nfile 'seg5.mp4'\nfile 'seg6.mp4'\nfile 'seg7.mp4'\n" > concat.txt
ffmpeg -y -v error -f concat -safe 0 -i concat.txt -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -shortest agentboard-demo.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 agentboard-demo.mp4
echo OK
