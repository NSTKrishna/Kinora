#!/usr/bin/env bash
#
# Generates every placeholder clip Kinora ships. Run it to reproduce them:
#
#     bash scripts/generate-mock-media.sh
#
# These are NOT AI renders. They are atmospheric plates drawn here with ffmpeg
# so that development and demos cost nothing, and so no third-party media ever
# ships with Kinora. Set PROVIDER=fal with a FAL_KEY to get real output.
#
# The look: a dark field with a single off-centre light source, soft bokeh from
# a blurred noise plate, a filmic contrast curve, chromatic aberration, lens
# vignette and grain — composited in RGB, because the chroma-neutral noise plate
# skews green if the blend and eq stages run on YUV.
#
# Quality is deliberately generous versus the first pass: 1280x720 instead of
# 480x270, and a real bitrate. The clips still cost ~200-400KB each.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOCK="$ROOT/public/mock"
FX="$MOCK/effects"
SEED="$ROOT/public/seed"
mkdir -p "$MOCK" "$FX" "$SEED"

FPS=24
CRF=26

# plate <out> <w> <h> <dur> <light> <mid> <deep> <edge> <lightx> <lighty> <motion> [seed]
#
# Colour order matters: a radial gradient runs c0 at the centre outward, so the
# signature colour has to be c0 — it is the light source. Putting it third, as
# the first pass did, buried it in a ring and every clip came out the same
# purple.
plate() {
  local out=$1 w=$2 h=$3 dur=$4 c0=$5 c1=$6 c2=$7 c3=$8 lx=$9 ly=${10} motion=${11} seed=${12:-0}
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=s=${w}x${h}:c0=${c0}:c1=${c1}:c2=${c2}:c3=${c3}:speed=0.010:seed=${seed}:d=${dur}:rate=${FPS}:nb_colors=4:type=radial:x0=${lx}:y0=${ly}" \
    -f lavfi -i "color=c=gray:s=96x54:d=${dur}:r=${FPS},noise=alls=100:allf=t+u,format=gbrp,scale=${w}:${h}:flags=bicubic,gblur=sigma=26" \
    -filter_complex "\
      [0:v]format=gbrp,eq=saturation=0.82:brightness=-0.06[base];\
      [1:v]eq=contrast=2.2:brightness=-0.42,gblur=sigma=10[bokeh];\
      [base][bokeh]blend=all_mode=screen:all_opacity=0.45[lit];\
      [lit]${motion}[mv];\
      [mv]chromashift=cbh=-4:crh=4,\
          curves=master='0/0 0.14/0.06 0.5/0.47 0.85/0.92 1/0.99',\
          vignette=a=PI/3.7,\
          noise=alls=10:allf=t+u,\
          format=yuv420p[out]" \
    -map "[out]" -t "$dur" -r "$FPS" -an \
    -c:v libx264 -crf "$CRF" -preset slow -movflags +faststart "$out"
  printf '  %-46s %sx%s  %ss  %sKB\n' "${out#"$ROOT"/}" "$w" "$h" "$dur" \
    "$(( $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") / 1024 ))"
}

drift() { echo "zoompan=z='1.05+0.03*sin(on/${2:-160})':x='iw/2-(iw/zoom/2)+${1:-24}*sin(on/190)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}"; }
push()  { echo "zoompan=z='1.02+0.14*on/(${FPS}*${D})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}"; }
pull()  { echo "zoompan=z='1.18-0.14*on/(${FPS}*${D})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}"; }
orbit() { echo "rotate=a='0.10*sin(t/2)':c=none:ow=iw:oh=ih,zoompan=z=1.12:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}"; }
rise()  { echo "zoompan=z=1.12:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-40*sin(on/(${FPS}*${D}))':d=1:s=${W}x${H}:fps=${FPS}"; }

echo "── composer result clips (one per aspect per supported length) ──"
for D in 6 8 10; do
  W=1280; H=720;  plate "$MOCK/ember-16x9-${D}s.mp4"  $W $H $D 0xffb066 0xc2452f 0x3c1030 0x080510 880 230 "$(drift 24)" 37
  W=720;  H=1280; plate "$MOCK/dusk-9x16-${D}s.mp4"   $W $H $D 0xbcd8ff 0x3f63b8 0x141f47 0x05070f 420 380 "$(drift 16)" 74
  W=960;  H=960;  plate "$MOCK/fog-1x1-${D}s.mp4"     $W $H $D 0xa8f0d2 0x239172 0x0d3b32 0x040a09 600 400 "$(drift 18)" 111
done

echo "── effect examples ──"
W=1280; H=720; D=6
plate "$FX/levitation.mp4"   $W $H $D 0xdce9ff 0x5a86d8 0x1a2a56 0x060911 300 170 "$(rise)" 148
plate "$FX/liquid-melt.mp4"  $W $H $D 0xff9a5c 0xd03a5e 0x4a1030 0x0d040f 980 430 "$(drift 30 120)" 185
plate "$FX/colossus.mp4"     $W $H $D 0xffd08a 0xc9761f 0x2d3a4e 0x070a11 1120 150 "$(pull)" 222
plate "$FX/bullet-orbit.mp4" $W $H $D 0xeef2f7 0x7d8b9c 0x232c38 0x05070a 640 360 "$(orbit)" 259
plate "$FX/paper-cutout.mp4" $W $H $D 0xffe7bd 0xd98a3a 0x5a3410 0x120a04 260 520 "$(drift 34 100)" 296
plate "$FX/portal-step.mp4"  $W $H $D 0xffd1a8 0xb03fa8 0x2e0f52 0x0a0418 640 360 "$(push)" 333
plate "$FX/hero-spin.mp4"    $W $H $D 0xf6f8fb 0x9aa3b0 0x2a2e36 0x08080b 1040 250 "$(orbit)" 370
plate "$FX/vertigo.mp4"      $W $H $D 0x9ff5d8 0x1f9c7a 0x0e3a33 0x040907 420 300 "$(push)" 407

echo "── Explore seed clips ──"
plate "$SEED/alley-dolly.mp4"    $W $H $D 0xffa971 0xc0344f 0x38103c 0x090412 880 480 "$(push)" 444
plate "$SEED/monolith-orbit.mp4" $W $H $D 0xc6ddff 0x4a6fc4 0x18234d 0x05070f 340 260 "$(orbit)" 481
plate "$SEED/helmet-zoom.mp4"    $W $H $D 0xffc48a 0x6d7f92 0x1d2733 0x05070a 1080 380 "$(push)" 518
plate "$SEED/crane-rooftops.mp4" $W $H $D 0xffe0a6 0xd08a2c 0x4a2a0c 0x120b04 200 200 "$(rise)" 555
plate "$SEED/corridor-track.mp4" $W $H $D 0xe8eef8 0x66768c 0x1d232e 0x090b10 640 180 "$(drift 40 110)" 592
W=720; H=1280
plate "$SEED/pines-push.mp4"     $W $H $D 0x9be8c9 0x1d7f66 0x0d3128 0x040806 380 420 "$(push)" 629
plate "$SEED/tide-lockoff.mp4"   $W $H $D 0xdfe4ec 0x78818f 0x252a33 0x07080a 360 640 "$(drift 10 240)" 666
W=1024; H=1280
plate "$SEED/curtain-window.mp4" $W $H $D 0xfff0d6 0x8d9bb0 0x232a36 0x080a0e 520 380 "$(drift 14 200)" 703

echo
echo "total: $(du -sh "$MOCK" "$SEED" | awk '{s=$1; print $2": "s}' | tr '\n' '  ')"
