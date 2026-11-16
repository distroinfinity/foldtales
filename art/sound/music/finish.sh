#!/bin/sh
# The music bed (lane E, Nov 16): one CC0 track, levelled to sit far under the voices and made into
# a seamless loop. Run from the repo root: sh art/sound/music/finish.sh
#
# Source: "Piano Ambience chord progression 82bpm" by CVLTIV8R, Freesound #810857, CC0 1.0
# (evidence: art/sound/music/LICENCE.md). The engine plays client/public/sound/music/bed.mp3.
set -eu
SRC=art/sound/music/source-810857-cvltiv8r-piano-ambience.mp3
OUT=client/public/sound/music/bed.mp3
X=3   # seconds of crossfade at the loop's seam
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
# 1. Level: -24 LUFS integrated, its swings narrowed (loudness range 6 LU), peaks at -2 dBTP.
# 2. Loop: the last X seconds cross-fade into the first X, then the body follows, so the end of
#    the file runs straight on into its start with no seam.
ffmpeg -hide_banner -loglevel error -y -i "$SRC" -filter_complex "
  [0:a]loudnorm=I=-24:LRA=6:TP=-2,aresample=44100,asplit=3[a][b][c];
  [a]atrim=start=$X:end=$(echo "$DUR - $X" | bc),asetpts=PTS-STARTPTS[body];
  [b]atrim=start=$(echo "$DUR - $X" | bc),asetpts=PTS-STARTPTS,afade=t=out:d=$X[tail];
  [c]atrim=end=$X,asetpts=PTS-STARTPTS,afade=t=in:d=$X[head];
  [tail][head]amix=inputs=2:normalize=0[seam];
  [seam][body]concat=n=2:v=0:a=1[out]" -map "[out]" -c:a libmp3lame -b:a 128k "$OUT"
echo "$OUT: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT") s"
