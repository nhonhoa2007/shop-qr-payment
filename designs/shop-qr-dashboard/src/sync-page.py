"""Update only page files, retaining datasets and the reader's current filters."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = Path('/home/nhonhoa/.codex/plugins/cache/baoyu-design/baoyu-dashboard/2.8.2/skills/claude-dashboard/scripts/artifact.mjs')
files = ['index.html','animate-preview.css','minimal.css','react-runtime.js','motion-runtime.js',
         'radix-runtime.js','animate-components.js','dashboard.js']
writes = []
for name in files:
    exists = (ROOT/'db'/'files'/(name+'.json')).exists()
    writes.append({'op':'update' if exists else 'set','path':'files/'+name,
                   'data':{'text':{'$file':str(ROOT/'src'/name)}}})
batch = ROOT/'src'/'page-batch.json'
batch.write_text(json.dumps(writes,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['node',str(ARTIFACT),'write-db',str(ROOT),str(batch)],check=True)
