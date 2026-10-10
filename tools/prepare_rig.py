"""Prépare le rig 2D de Moussa : réparation d'une copie du maître, découpe en calques, contrôle.

Usage : python3 tools/prepare_rig.py moussa_rigging_stage/00_MOUSSA_MASTER_UNTOUCHED.png [dossier_de_sortie]
Écrit par défaut dans moussa_rig/. Le maître n'est jamais modifié : il est copié puis comparé octet par octet.

Les polygones et lignes de coupe de tools/rig/segment.py sont tracés à la main pour l'illustration
actuelle (1024 x 1536). Une autre image demande de les retracer.
"""
import sys, shutil, hashlib, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent / 'rig'


def run(script: str, *args: object) -> None:
    subprocess.run([sys.executable, str(HERE / script), *map(str, args)], check=True)


def main(master: Path, out: Path) -> None:
    for sub in ('00_maitre', '01_base'):
        (out / sub).mkdir(parents=True, exist_ok=True)
    copy = out / '00_maitre' / master.name
    shutil.copyfile(master, copy)
    base = out / '01_base'
    run('repair.py', master, base)
    run('segment.py', base)
    run('build_layers.py', base, out)
    shutil.move(str(base / 'layers_meta.json'), str(out / 'calques.json'))
    (base / 'recon_all.npy').unlink()
    run('simulate.py', out)
    run('make_ora.py', out, master)
    same = hashlib.sha256(master.read_bytes()).hexdigest() == hashlib.sha256(copy.read_bytes()).hexdigest()
    print('maître copié à l\'identique :', 'oui' if same else 'NON')


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve(), Path(sys.argv[2] if len(sys.argv) == 3 else Path(__file__).resolve().parent.parent / 'moussa_rig').resolve())
