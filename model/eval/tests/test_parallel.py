"""Offline checks for bounded concurrency and resumable comparisons."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import compare_openai as compare


class ParallelTests(unittest.TestCase):
    def test_overlapping_requests_preserve_order_and_bound(self):
        active = peak = 0
        lock = threading.Lock()

        def work(i):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(.01 * (4 - i % 4))
            with lock:
                active -= 1
            return i

        self.assertEqual(list(compare.ordered_parallel(work, range(12), 4)), list(range(12)))
        self.assertEqual(peak, 4)

    def test_failure_does_not_submit_entire_split(self):
        started = []

        def work(i):
            started.append(i)
            if i == 0:
                raise RuntimeError('outage')
            return i

        with self.assertRaisesRegex(RuntimeError, 'outage'):
            list(compare.ordered_parallel(work, range(100), 4))
        self.assertLessEqual(len(started), 4)

    def test_comparison_checkpoints_resume_in_order(self):
        source = compare.ROOT / 'fixtures/demo/demo.jsonl'
        items = [json.loads(line) for line in source.read_text().splitlines()][:4]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            baseline = root / 'baseline'
            baseline.mkdir()
            for split, relative in [('demo', 'fixtures/demo/demo.jsonl'),
                                    ('test', 'data/generated/test.jsonl'),
                                    ('paraphrase', 'data/generated/paraphrase.jsonl')]:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('\n'.join(json.dumps(item) for item in items))
                rows = []
                for item in items:
                    req, label = item['meta']['request'], item['meta']['label']
                    row = compare.score(req, label, '{}')
                    row.update(id=req['requestId'], gold_status=label['status'], latency_ms=1)
                    rows.append(row)
                (baseline / f'eval-ft-{split}.json').write_text(json.dumps(
                    {'meta': {}, 'rows': rows, 'metrics': compare.aggregate(rows)}))
            out = root / 'out'
            argv = ['compare', '--baseline', str(baseline), '--out', str(out)]
            calls = []

            def request(req, key, model):
                calls.append(req['requestId'])
                return '{}', 1, {'usage': {}, 'resolved_model': model,
                                 'finish_reason': 'stop', 'refusal': None}

            with patch.object(compare, 'ROOT', root), patch.object(sys, 'argv', argv), \
                 patch.object(compare, 'credential', return_value='fake'), \
                 patch.object(compare, 'request_one', side_effect=request), \
                 contextlib.redirect_stdout(io.StringIO()):
                compare.main()
                self.assertEqual(len(calls), 12)
                # Simulate an interrupted split with only a prefix checkpointed.
                checkpoint = out / 'rows-test.jsonl'
                checkpoint.write_text('\n'.join(checkpoint.read_text().splitlines()[:2]) + '\n')
                compare.main()
                self.assertEqual(len(calls), 14)
                compare.main()
                self.assertEqual(len(calls), 14)
            result = json.loads((out / 'eval-gpt54mini-test.json').read_text())
            self.assertEqual([row['id'] for row in result['rows']],
                             [item['meta']['request']['requestId'] for item in items])
            self.assertEqual(result['meta']['concurrency'], 4)
            self.assertIn('concurrency 4', (out / 'comparison.md').read_text())


if __name__ == '__main__':
    unittest.main()
