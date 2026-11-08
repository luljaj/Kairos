"""Render the completed r1 archive only; rerun after explicitly selecting final results."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'model/benchmarks/2026-11-08-luna-comparison'
OUT = Path(__file__).parent
models = [('qwen_base', 'Qwen 4B · base'), ('qwen_finetuned_r1', 'Qwen 4B · fine-tuned r1'), ('gpt54mini', 'GPT-5.4-mini'), ('gpt6luna', 'GPT-6 Luna')]
records = []
for split in ['test', 'paraphrase']:
    for key, label in models:
        rows = json.loads((SOURCE / 'results' / f'{key}-{split}.json').read_text())['rows']
        rec = [r for r in rows if r.get('rec_match') is not None]
        records.append(dict(split=split, model=key, label=label, n=len(rows), acuity_correct=sum(r['acuity_exact'] for r in rows), acuity_percent=100*sum(r['acuity_exact'] for r in rows)/len(rows), recommendation_correct=sum(r['rec_match'] for r in rec), recommendation_n=len(rec), recommendation_percent=100*sum(r['rec_match'] for r in rec)/len(rec)))
data = dict(status='Provisional submission graphic: completed r1 checkpoint; later training excluded.', source=str(SOURCE.relative_to(ROOT)), metric='Exact rubric acuity match, including expected needs_more_info cases', records=records, limitations=['Synthetic rubric labels, not clinical ground truth.', 'Paraphrase challenge selected for keyword-rule disagreements; not a random sample.', 'All rows are held out from training; repeated evaluation during development limits independence.', 'Single runs; small differences do not establish model superiority.', 'API models used strict structured output; Qwen used guided decoding.', 'Recommendation denominator excludes gold needs_more_info cases.'])
(OUT.parent / 'benchmark-data.json').write_text(json.dumps(data, indent=2)+'\n')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'svg.fonttype':'none'})
fig, axes=plt.subplots(1,2,figsize=(14,7.5),gridspec_kw={'wspace':0.54})
fig.patch.set_facecolor('#fafaf8')
colors=['#9ba6ac','#16715f','#b2bbc0','#b2bbc0']
for ax, split, heading in zip(axes,['test','paraphrase'],['Held-out scenarios · 300 cases','Wording challenge · 150 cases']):
    vals=[r for r in records if r['split']==split]
    ax.set_facecolor('#fafaf8')
    ax.barh(range(4),[r['acuity_percent'] for r in vals],height=0.52,color=colors,zorder=3)
    ax.set_yticks(range(4),[r['label'] for r in vals],fontsize=11)
    ax.invert_yaxis(); ax.set_xlim(0,106)
    ax.set_xticks([0,25,50,75,100]); ax.xaxis.set_major_formatter(PercentFormatter())
    ax.tick_params(axis='both',length=0,pad=9,labelcolor='#39454a')
    ax.grid(axis='x',color='#dfe3e1',linewidth=0.7,zorder=0)
    for sp in ax.spines.values(): sp.set_visible(False)
    ax.set_title(heading,loc='left',fontsize=13,fontweight='bold',pad=22,color='#263b37')
    for i,r in enumerate(vals): ax.text(r['acuity_percent']+1.5,i,f"{r['acuity_percent']:.1f}%",va='center',fontsize=11,fontweight='bold' if i==1 else 'normal',color='#16715f' if i==1 else '#39454a')
fig.subplots_adjust(left=.17,right=.95,top=.69,bottom=.28)
fig.text(.055,.92,'Does fine-tuning improve dispatch judgments?',fontsize=21,fontweight='bold',color='#183b33')
fig.text(.055,.86,'Exact match to our synthetic acuity rubric',fontsize=14,color='#4b5853')
fig.text(.055,.80,'PROVISIONAL  ·  Completed r1 checkpoint; later training results pending',fontsize=10,color='#6a716b')
fig.text(.055,.16,'Fine-tuning improved held-out accuracy by 18.7 percentage points over the base model.',fontsize=12,color='#263b37')
fig.text(.055,.105,'Same evaluation inputs and rubric prompt. Scores include cases requiring more information.\nSynthetic scenarios, not clinical validation. The wording challenge was selected for keyword-rule disagreements.',fontsize=9.5,color='#636d67',linespacing=1.55)
fig.savefig(OUT/'benchmark-r1-provisional.png',dpi=180,facecolor=fig.get_facecolor())
fig.savefig(OUT/'benchmark-r1-provisional.svg',facecolor=fig.get_facecolor())
print(json.dumps(records,indent=2))
