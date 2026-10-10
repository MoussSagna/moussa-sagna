"""Assemble les calques en un fichier OpenRaster (.ora), éditable dans Krita ou GIMP.

Usage : make_ora.py dossier_rig maître_original.png
"""
import sys, json, io, zipfile
from pathlib import Path
from PIL import Image

rig = Path(sys.argv[1]); master = Path(sys.argv[2])
meta = json.load(open(rig / 'calques.json'))
GROUPS = [('Tête', ['hair', 'head']), ('Haut du corps', ['sleeve_l', 'sleeve_r', 'arm_l', 'jacket', 'arm_r', 'torso']),
          ('Bas du corps (fixe)', ['lower']), ('Rubans', ['rb_knot', 'rb_top', 'rb_right', 'rb_hip', 'rb_bottom', 'rb_low', 'rb_mid', 'rb_long'])]
files = {m['name']: m['file'] for m in meta}
# l'ordre des groupes doit rester celui de l'empilement (du premier plan vers le fond)
flat = [n for _, names in GROUPS for n in names]
assert flat == [m['name'] for m in reversed(meta)], 'groupes incohérents avec l\'ordre des calques'
W, H = Image.open(master).size
xml = ['<?xml version="1.0" encoding="UTF-8"?>', f'<image version="0.0.3" w="{W}" h="{H}" xres="72" yres="72">', ' <stack>']
for title, names in GROUPS:
    xml.append(f'  <stack name="{title}" visibility="visible" opacity="1.0" composite-op="svg:src-over" isolation="isolate">')
    for n in names:
        xml.append(f'   <layer name="{Path(files[n]).stem}" src="data/{Path(files[n]).name}" x="0" y="0" visibility="visible" opacity="1.0" composite-op="svg:src-over"/>')
    xml.append('  </stack>')
xml.append('  <stack name="Références (masquées)" visibility="hidden" opacity="1.0" composite-op="svg:src-over">')
xml.append('   <layer name="maître réparé (copie)" src="data/master_repaired.png" x="0" y="0" visibility="hidden" opacity="1.0" composite-op="svg:src-over"/>')
xml.append('   <layer name="MAÎTRE ORIGINAL - ne pas modifier" src="data/master_original.png" x="0" y="0" visibility="hidden" opacity="1.0" composite-op="svg:src-over"/>')
xml += ['  </stack>', ' </stack>', '</image>']
merged = Image.open(rig / '01_base' / 'master_repaired.png').convert('RGBA')
thumb = merged.copy(); thumb.thumbnail((256, 256))
def png(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
(rig / '04_source').mkdir(exist_ok=True)
with zipfile.ZipFile(rig / '04_source' / 'moussa_rig.ora', 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'image/openraster', compress_type=zipfile.ZIP_STORED)
    z.writestr('stack.xml', '\n'.join(xml), compress_type=zipfile.ZIP_DEFLATED)
    for n in flat:
        z.write(rig / files[n], f'data/{Path(files[n]).name}', compress_type=zipfile.ZIP_STORED)
    z.write(rig / '01_base' / 'master_repaired.png', 'data/master_repaired.png', compress_type=zipfile.ZIP_STORED)
    z.write(master, 'data/master_original.png', compress_type=zipfile.ZIP_STORED)
    z.writestr('mergedimage.png', png(merged)); z.writestr('Thumbnails/thumbnail.png', png(thumb))
print('écrit', rig / '04_source' / 'moussa_rig.ora')
