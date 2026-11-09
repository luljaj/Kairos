# Archived training artifacts

The NYCAIRR × HackBU hackathon is over. Training finished on November 7–8, 2026, and the Empire AI account was scheduled to close at 5 p.m. Eastern on November 9. We preserved the project artifacts before that deadline. No training or serving jobs were running when the account was checked on November 9; the demo server had reached its time limit on November 8.

**The selected model is still `r3-4b`.** The later `r5-4b` run completed but did not improve the selection results. The cluster addresses in the historical serving documentation are not active endpoints.

## Download

The weights and checkpoints are attached to the [training archive release](https://github.com/luljaj/Kairos/releases/tag/training-archive-2026-11-09), rather than stored in Git history. A normal clone contains the source and benchmark documentation; download the release assets separately for model weights and generated training data.

| Asset | Contents / purpose |
|---|---|
| `run-r3-4b.tar.gz` | **Selected model:** final adapter, tokenizer, prepared data, saved checkpoints, evaluation outputs, configuration and reload check |
| `run-r1.tar.gz` | Initial 4B training run; starting adapter for r3 |
| `run-r2-1p7b.tar.gz` | Completed smaller-model experiment |
| `run-r5-4b.tar.gz` | Completed weighted-recommendation follow-up and its results |
| `run-r5-step100.tar.gz` | Intermediate r5 adapter |
| `run-r4-1p7b.tar.gz` | Cancelled continuation's configuration; no completed trained model |
| `run-smoke.tar.gz` | Initial smoke training and checkpoint artifacts |
| `project-and-provenance.tar.gz` | Cloud source snapshot, generated datasets, logs, schemas, prompt, rubric, environment inventories, job history, verifier backup, original file checksums, and newer local source/benchmark/experiment archives |
| `SHA256SUMS` | SHA-256 checksums of all downloadable archives |

The original cloud snapshot contains **298 files / 2,528,237,215 bytes**. Every file was compared with a SHA-256 manifest generated on Empire; all matched. The extra laptop archives preserve newer source, benchmark reports and API comparison records separately from the historical cloud snapshot.

The public Hugging Face base-weight cache, installed environments, compiler caches and account credentials are excluded. The recovery planning document is also excluded.

## Restore the archive

Download and verify all release assets in a new directory:

```bash
mkdir kairos-training-archive
cd kairos-training-archive
gh release download training-archive-2026-11-09 --repo luljaj/Kairos
shasum -a 256 -c SHA256SUMS
mkdir restored
tar -xzf project-and-provenance.tar.gz -C restored
for asset in run-*.tar.gz; do
  tar -xzf "$asset" -C restored/cloud-project
done
```

The reconstructed cloud project is under `restored/cloud-project/`. Its original per-file manifest and verification result are under `restored/metadata/`. The two nested laptop archives can be extracted into separate directories for comparison; do not overwrite current source with the historical snapshot.

For inference only, the main downloads are `run-r3-4b.tar.gz` and `project-and-provenance.tar.gz`. Earlier adapters and optimizer checkpoints are useful for reproducing experiments or resuming training, but are not needed to serve the final r3 adapter.

## Run the selected model again

The adapter is **not a standalone full model**. Load `model/runs/r3-4b/adapter` with:

- Base: `Qwen/Qwen3-4B-Instruct-2507`
- Recorded base revision: `cdbee75f17c01a7cc42f958dc650907174af0554`
- Runtime prompt: `model/prompt.md`
- Request/response contracts: `model/schemas/`
- Ranked serving: `model/serving/` and `model/rubric.py`

Rebuild compatible environments using `metadata/train-packages.txt` and `metadata/serve-packages.txt`, with `model/cluster/setup_login.sh` as a reference. The inventories record installed versions; they are not portable environment images. The Slurm scripts contain the original account, reservation, GPU and path assumptions and need adjustment for a new host.

Follow [serving instructions](SERVING.md) with a new endpoint and `SERVE_RANK_CANDIDATES=1` to reproduce the selected combined pipeline. Run the saved demo and held-out evaluations after loading on the new host. Archival verification checked file integrity; it did not perform a new GPU inference test.

## Interpreting the results

On the 300-case held-out test, the selected raw r3 adapter reached **91.7% acuity accuracy** and **94.3% recommendation accuracy**. A separate ranked-serving evaluation reached **92.0% acuity**, **99.2% recommendation**, and **100% schema validity**. Recommendation accuracy is measured on eligible ready cases.

The ranked endpoint combines model-predicted acuity with deterministic fleet selection. It must not be presented as the raw model's recommendation accuracy. These are synthetic prototype-rubric benchmarks, not clinical validation; evaluation feedback influenced development. See [training history](../docs/training.md) and [benchmark methodology](../docs/benchmarks.md).
