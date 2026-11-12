#!/bin/zsh
# Levels each clip to its role's peak and writes the finished clip to art/sound/m1/.
# Usage, from the repo root: zsh art/runs/009-m1-sound/finish.sh
set -e
RUN=art/runs/009-m1-sound
OUT=art/sound/m1
typeset -A target
target=(book-thump -6 cover-open -8 card-fold-a -10 card-fold-b -10 card-fold-c -10 gust -7 lantern-puff -8 wash-bloom -11 card-tap -14 paper-rustle -15 felt-thud -11 ember-hum -26 narrator-opening -3 pip-gasp -8)
for name in ${(k)target}; do
  peak=$(ffmpeg -hide_banner -i $RUN/$name.mp3 -af volumedetect -f null - 2>&1 | awk '/max_volume/ {print $5}')
  gain=$(python3 -c "print(round(${target[$name]} - ($peak), 2))")
  ffmpeg -hide_banner -loglevel error -y -i $RUN/$name.mp3 -af "volume=${gain}dB" -ac 1 -codec:a libmp3lame -q:a 3 $OUT/$name.mp3
  echo "$name: peak $peak dB, gain $gain dB, now ${target[$name]} dB"
done
