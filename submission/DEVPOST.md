# Kairos

AI-assisted ambulance dispatch.

## Inspiration

Several of our friends work at Harpur’s Ferry, which got us interested in how ambulance dispatch works. From those conversations, we learned that dispatchers don’t have a live view of each ambulance’s location. They send the next available ambulance, but that may not be the closest suitable crew—even when another ambulance is already working nearby.

We also looked at the broader problem of callers waiting to reach a call-taker when emergency call centers are overwhelmed. Kairos grew out of both concerns: helping gather incident information earlier and giving dispatchers the location and crew information they need to decide who to send.

## What it does

Kairos brings phone intake, incident assessment, and ambulance assignment into one interface. It uses **ElevenLabs to take phone calls** and gather incident details, which appear in the dispatcher’s dashboard alongside a map of the fleet.

Our fine-tuned model, **Qwen-4b-Dispatch**, assesses incident acuity and proposes an ambulance using incident details and fleet context. A deterministic guardrail layer applies fleet suitability and ranking rules to that assessment. Dispatchers can compare crews by estimated arrival time, availability, and medical capabilities, then approve or override the recommendation. The dispatcher makes the final assignment.

The prototype uses simulated ambulances and assignments; it is not connected to Harpur’s Ferry’s operational fleet.

## How we built it

We fine-tuned **Qwen3-4B-Instruct-2507** into **Qwen-4b-Dispatch**. Most of the model work went into building the training data, fitting training within our GPU allocation, and investigating where the model’s decisions broke down.

We started with **3,000 synthetic dispatch scenarios** covering caller descriptions, missing information, ambulance availability, travel times, and crew qualifications. Target responses came from an explicit prototype dispatch rubric. We checked their schema, label consistency, and whether numerical claims matched the input. We also included indirect descriptions and paraphrases to test interpretation beyond keyword matching.

Training ran on **Empire AI’s Alpha cluster**, with Slurm scheduling jobs on a **10 GB NVIDIA H100 MIG slice**. We used **QLoRA**, loading the base model in 4-bit NF4 with double quantization and training rank-16 LoRA adapters across its linear layers. Our stack used **PyTorch, Hugging Face Transformers, TRL’s SFTTrainer, PEFT, and bitsandbytes**. BF16 computation, gradient checkpointing, and gradient accumulation gave us an effective batch size of 16 within the memory limit.

We applied loss only to the assistant’s response. For 30% of training examples, we replaced the full rubric prompt with a short instruction, then evaluated that shorter prompt separately to investigate how much the model learned through fine-tuning.

Follow-up training added verified language contrasts and paired fleet scenarios where changing arrival time or crew experience should change the recommendation. Our selected adapter trained on **3,940 examples** after the initial run. A later experiment used **4,520 examples** and extra loss weight on ambulance-selection tokens, but did not outperform the earlier adapter on the main test set.

For inference, we use **vLLM with FP8 quantization and schema-constrained JSON output**. The rest of Kairos uses **Next.js, TypeScript, and Mapbox**. ElevenLabs passes incident details to the backend through tools, and server-sent events deliver updates to the dashboard. The backend checks that recommendations still match the current incident and fleet state before they can be accepted.

## Challenges we ran into

The model initially learned shortcuts from repeated wording. Seeing “car crash,” for example, could push it toward Charlie severity regardless of the other details. We generated paraphrases and contrasting scenarios to make those shortcuts less useful, then tested unfamiliar wording separately.

We also found that our initial training split had **no examples establishing unconsciousness through the caller’s words alone**. The first adapter could ask for more information when someone was described as “out cold.” A follow-up run incorporating verified examples of definite unconsciousness versus uncertain responsiveness, alongside other targeted changes, improved main-test acuity accuracy from **88.3% to 91.7%**.

The hardest fleet rule balanced arrival time against crew experience. Our prototype rubric sometimes favors a slightly slower ambulance with a more experienced crew chief on high-acuity calls. Paired examples and extra loss weight did not consistently resolve this weakness. The selected raw model reached **94.3% recommendation accuracy**, below our 95% target.

We added a **deterministic guardrail layer** between the model and dashboard. It takes Qwen’s predicted acuity and the supplied fleet information, applies explicit suitability and ranking rules, and recomputes the recommended ambulance and candidate explanations. It can replace Qwen’s proposed ambulance, including when the experience exception applies, but leaves the acuity assessment unchanged. The dispatcher reviews the result and decides who to send.

Each training iteration also took hours. The final weighted run took roughly **2½ hours**, but performed worse on the main test set than the previous adapter. We selected the earlier checkpoint based on its evaluation results.

## Accomplishments we’re proud of

We trained a specialized four-billion-parameter model on Empire AI and connected it to a dispatch workflow with phone intake, fleet visibility, and human approval.

Fine-tuning improved exact acuity accuracy from **71.3% to 91.7%** on our 300-case main test set. The selected raw model also achieved **93.3% acuity accuracy on 150 paraphrase challenges**, testing the unfamiliar wording that caused problems early on.

| Model / pipeline | Acuity accuracy · 300 cases | Ambulance selection · 264 eligible cases |
|---|---:|---:|
| Base Qwen3-4B | 71.3% | 81.1% |
| GPT-5.4-mini | 85.7% | 88.6% |
| GPT-6 Luna | 88.0% | 90.2% |
| Qwen-4b-Dispatch | 91.7% | 94.3% |
| **Qwen-4b-Dispatch + deterministic guardrails** | **92.0%** | **99.2%** |

The raw-model comparisons use the same scenarios and full rubric prompt, with structured output enforced. GPT comparisons used reasoning disabled. Acuity scoring includes correctly identifying when more information is needed.

The guardrail pipeline was evaluated in a separate inference run, which accounts for the small acuity difference; **the guardrails do not modify acuity**. The complete pipeline returned schema-valid responses across all **490 test, paraphrase, and demo scenarios**.

These results measure agreement with our **synthetic prototype rubric**, not clinical correctness. Guardrails enforce the fleet rubric but cannot guarantee a correct incident assessment. Evaluation findings informed later training iterations, so a fresh, untouched test set remains an important next step.

## What we learned

The training data mattered as much as the training setup. When the model made a mistake, another training run wasn’t always the answer. Examining its failures revealed missing examples, repeated wording, and distinctions we hadn’t taught it clearly. Our latest checkpoint wasn’t our best one, either.

We also learned to evaluate incident assessment and ambulance selection separately. A model could understand a call’s severity and still recommend the wrong crew. That shaped our approach: use Qwen to interpret incident details, apply explicit fleet rules through guardrails, and give the dispatcher enough information to review the recommendation.

## What’s next for Kairos

We want feedback from Harpur’s Ferry EMTs and dispatchers on whether the information we show would help during an actual shift, what’s missing, and where the interface could create extra work.

For the model, we want a fresh evaluation set with more ambiguous descriptions, incomplete information, and varied caller language. We also need to test the complete phone-intake workflow: a correct assessment depends on the right details making it from the caller to the model.

Moving beyond the simulated fleet would require reliable ambulance location and availability data, agreement on dispatch rules, and careful handling of caller information. We’d start by testing alongside an existing workflow, with dispatchers reviewing recommendations before considering operational use.
