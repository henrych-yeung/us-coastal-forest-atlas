#!/usr/bin/env python3
"""Generate gdaldem color-relief ramp files (value R G B A) for each webapp layer.

Palettes baked into RGBA so the frontend just draws PNG tiles. Transparency is
handled via the alpha column and the `nv` (nodata) entry.
"""
import os
import matplotlib.cm as cm
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "ramps")
os.makedirs(OUT, exist_ok=True)


def rgb(cmap, t):
    r, g, b, _ = cmap(float(np.clip(t, 0, 1)))
    return int(round(r * 255)), int(round(g * 255)), int(round(b * 255))


def write(name, lines):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", path)


# ---- Mortality (and wetland): Reds, value 0 -> transparent, 5 -> deep red ----
# units ha-1 yr-1; cap display at 5. Alpha ramps 0->255 over the first 0.5.
reds = cm.get_cmap("Reds")
mort = ["nv 0 0 0 0"]
stops = np.linspace(0, 5, 26)
for v in stops:
    t = v / 5.0
    r, g, b = rgb(reds, 0.12 + 0.88 * t)  # start a bit into the ramp (skip near-white)
    a = int(round(min(255, 255 * (v / 0.5)))) if v > 0 else 0
    mort.append(f"{v:.3f} {r} {g} {b} {a}")
# clamp anything above 5 to the deepest red
mort.append(f"200 {rgb(reds,1.0)[0]} {rgb(reds,1.0)[1]} {rgb(reds,1.0)[2]} 255")
write("mortality.txt", mort)

# ---- Uncertainty: nYears, viridis. orig 10..30 -> display 1..3. clamp >30. ----
vir = cm.get_cmap("viridis")
unc = ["nv 0 0 0 0", "0 0 0 0 0"]
for orig in np.linspace(10, 30, 21):
    t = (orig - 10) / 20.0
    r, g, b = rgb(vir, t)
    unc.append(f"{orig:.2f} {r} {g} {b} 255")
unc.append(f"200 {rgb(vir,1.0)[0]} {rgb(vir,1.0)[1]} {rgb(vir,1.0)[2]} 255")
write("uncertainty.txt", unc)

# ---- DEM: grayscale, 0 m -> black, >=5 m -> white. clamp. ----
dem = ["nv 0 0 0 0"]
dem.append("-10000 0 0 0 255")
dem.append("0 0 0 0 255")
for m in np.linspace(0, 5, 11):
    g = int(round(255 * (m / 5.0)))
    dem.append(f"{m:.2f} {g} {g} {g} 255")
dem.append("5 255 255 255 255")
dem.append("10000 255 255 255 255")
write("dem.txt", dem)
