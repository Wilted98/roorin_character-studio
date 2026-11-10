"""Find the user's existing exports without renaming or modifying them."""
import os
from pathlib import Path
def discover_source(kind):
    override=os.environ.get('ROORIN_ASSETS' if kind=='textures' else 'ROORIN_PROPERTIES')
    if override:return Path(override)
    desktop=Path.home()/'Desktop'
    candidates=[]
    for pattern in ['*/*/Content','*/*/*/Content']:
        for path in desktop.glob(pattern):
            marker=path/('Character/Player/GF/Head/GF_Head_001/GF_Head_001.uemodel' if kind=='textures' else 'UnrealData/PcCustomizeFeatureTable_PresetFace.json')
            if marker.exists():candidates.append(path)
        if candidates:break
    if len(candidates)!=1:raise RuntimeError(f'Set ROORIN_{"ASSETS" if kind=="textures" else "PROPERTIES"} to the intended Content folder. Found {len(candidates)} candidates.')
    return candidates[0]
