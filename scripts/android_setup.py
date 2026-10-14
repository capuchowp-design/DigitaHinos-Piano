#!/usr/bin/env python3
"""Ajusta o projeto Android gerado pelo Capacitor (rodar depois de `npx cap add android` e `npx cap sync`).

Faz: versão do app, ícones (a partir de icon-512x512.png, icon-foreground.png e icon-background.png), tela de abertura própria (sem logo de terceiros).
"""
import glob, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID = os.path.join(ROOT, "android")
RES = os.path.join(ANDROID, "app", "src", "main", "res")
BG_PNG = os.path.join(ROOT, "icon-background.png")
if os.path.exists(BG_PNG):
    _bg = Image.open(BG_PNG).convert("RGB")
    _c = _bg.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
else:
    _bg, _c = None, (247, 190, 40)
GOLD = (_c[0], _c[1], _c[2], 255)
GOLD_HEX = "#%02X%02X%02X" % _c

def die(msg):
    print("ERRO:", msg)
    sys.exit(1)

# ---------- versão ----------
ver = {}
for line in open(os.path.join(ROOT, "version.txt"), encoding="utf-8"):
    if "=" in line:
        k, v = line.strip().split("=", 1)
        ver[k.strip()] = v.strip()
name, code = ver.get("VERSION_NAME"), ver.get("VERSION_CODE")
if not name or not code or not code.isdigit():
    die("version.txt precisa ter VERSION_NAME=1.0.0 e VERSION_CODE=1 (número inteiro)")
gradle = os.path.join(ANDROID, "app", "build.gradle")
if not os.path.exists(gradle):
    die("android/app/build.gradle não encontrado")
g = open(gradle, encoding="utf-8").read()
g, n1 = re.subn(r"versionCode\s+\d+", "versionCode " + code, g)
g, n2 = re.subn(r'versionName\s+"[^"]*"', 'versionName "' + name + '"', g)
if n1 != 1 or n2 != 1:
    die("não consegui trocar versionCode/versionName no build.gradle (%d/%d)" % (n1, n2))
open(gradle, "w", encoding="utf-8").write(g)
print("Versão:", name, "(código %s)" % code)

# ---------- ícones ----------
_ic = os.path.join(ROOT, "icon-512x512.png")
if not os.path.exists(_ic):
    _ic = os.path.join(ROOT, "icon-512.png")
if not os.path.exists(_ic):
    die("falta o ícone icon-512x512.png (ou icon-512.png)")
icon = Image.open(_ic).convert("RGBA")
fg = Image.open(os.path.join(ROOT, "icon-foreground.png")).convert("RGBA")
legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

def circle(im):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, im.size[0] - 1, im.size[1] - 1), fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

for dens, px in legacy.items():
    d = os.path.join(RES, "mipmap-" + dens)
    os.makedirs(d, exist_ok=True)
    sq = icon.resize((px, px), Image.LANCZOS)
    sq.save(os.path.join(d, "ic_launcher.png"), optimize=True)
    # redondo: fundo dourado cheio recortado em círculo
    full = _bg.resize((px, px), Image.LANCZOS).convert("RGBA") if _bg else Image.new("RGBA", (px, px), GOLD)
    full.alpha_composite(fg.resize((px, px), Image.LANCZOS))
    circle(full).save(os.path.join(d, "ic_launcher_round.png"), optimize=True)
for dens, px in adaptive.items():
    d = os.path.join(RES, "mipmap-" + dens)
    os.makedirs(d, exist_ok=True)
    fg.resize((px, px), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"), optimize=True)

if _bg:
    for dens, px in adaptive.items():
        _bg.resize((px, px), Image.LANCZOS).save(os.path.join(RES, "mipmap-" + dens, "ic_launcher_background.png"), optimize=True)
os.makedirs(os.path.join(RES, "values"), exist_ok=True)
open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % GOLD_HEX)
bg_line = ('    <background android:drawable="@mipmap/ic_launcher_background"/>\n' if _bg
           else '    <background android:drawable="@color/ic_launcher_background"/>\n')
adaptive_xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                + bg_line +
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '</adaptive-icon>\n')
d = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(d, exist_ok=True)
for fn in ("ic_launcher.xml", "ic_launcher_round.xml"):
    open(os.path.join(d, fn), "w", encoding="utf-8").write(adaptive_xml)
# remove o ícone vetorial padrão do modelo (se existir) para não conflitar
for stale in glob.glob(os.path.join(RES, "drawable*", "ic_launcher_foreground.xml")):
    os.remove(stale)
for stale in glob.glob(os.path.join(RES, "drawable*", "ic_launcher_background.xml")):
    os.remove(stale)
print("Ícones: ok")

# ---------- tela de abertura (substitui a imagem padrão do modelo) ----------
splashes = glob.glob(os.path.join(RES, "drawable*", "splash*.png"))
for f in splashes:
    w, h = Image.open(f).size
    canvas = Image.new("RGBA", (w, h), GOLD)
    side = int(min(w, h) * 0.42)
    logo = icon.resize((side, side), Image.LANCZOS)
    canvas.alpha_composite(logo, ((w - side) // 2, (h - side) // 2))
    canvas.convert("RGB").save(f, optimize=True)
print("Tela de abertura: %d imagem(ns) trocada(s)" % len(splashes))
styles = os.path.join(RES, "values", "styles.xml")
if os.path.exists(styles):
    s = open(styles, encoding="utf-8").read()
    s2 = s.replace("@drawable/splash", "@color/ic_launcher_background")
    if s2 != s:
        open(styles, "w", encoding="utf-8").write(s2)
        print("styles.xml: fundo da abertura trocado")

# ---------- barra superior: o app NÃO fica por baixo da barra de status/notch/botões ----------
BG_APP = "#0A0A0F"
cands = glob.glob(os.path.join(ANDROID, "app", "src", "main", "java", "**", "MainActivity.java"), recursive=True)
if not cands:
    print("AVISO: MainActivity.java não encontrado; usando só o ajuste de CSS (env(safe-area-inset-top)).")
else:
    mf = cands[0]
    pkg = re.search(r"^\s*package\s+([\w.]+);", open(mf, encoding="utf-8").read(), re.M).group(1)
    java = """package %s;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.getDecorView().setBackgroundColor(Color.parseColor("%s"));
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
        final View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout()
                | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
    }
}
""" % (pkg, BG_APP)
    open(mf, "w", encoding="utf-8").write(java)
    print("MainActivity: barra superior/inferior do sistema respeitada (%s)" % pkg)
print("Pronto.")
