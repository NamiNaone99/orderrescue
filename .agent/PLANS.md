# Writing an ExecPlan

Save one plan per task at `.agent/plans/T<nn>.md`. Copy the Markdown inside the fence below into that file and replace the prompts with task-specific details. A teammate with a fresh checkout should be able to implement the plan, resume it midway and demonstrate the result using the plan alone. Explain any terminology, prerequisites and specification rules they will need. [OpenAI Cookbook guide to ExecPlans](https://developers.openai.com/cookbook/articles/codex_exec_plans)

```md
# T<nn> — <action and observable result>

Maintain this plan according to `.agent/PLANS.md`. Update the four living sections as work proceeds. Date each revision and record its reason at the bottom.

## Purpose

Describe who benefits, what they can do when the task is complete and how they can see the difference.

## Progress

Update this checklist at each stopping point. Split partial work into completed and pending steps. Replace the timestamp placeholders with actual dates, times and offsets.

- [x] (<YYYY-MM-DD HH:mm +07:00>) <Completed step and evidence.>
- [ ] (<YYYY-MM-DD HH:mm +07:00>) <Next action needed to reach a verifiable milestone.>

## Surprises & Discoveries

Record what you observed, the command or example that exposed it and its effect on the work.

## Decision Log

For each decision, record the date, author, choice and rationale. Revise the affected milestones when the choice changes the approach.

## Outcomes & Retrospective

At each major milestone and at completion, compare the demonstrated result with the purpose. Record evidence, outstanding gaps and lessons for the next contributor.

## Starting point

Describe the current behaviour and the relevant paths relative to the repository root. Explain how the files fit together. Identify required tools, configuration, input data and interfaces, including the inputs and outputs callers rely on.

## Milestones and steps

Give each milestone a heading that names its result. Describe the changes in order, naming files and functions. Specify the working directory and exact PowerShell commands, with short expected output, so a teammate can verify each milestone independently. Indent commands and transcripts by four spaces.

## Validation and acceptance

Walk through a concrete input via the normal entry point. Give the action, expected observable result and task-specific test commands. For an internal change, identify a test that demonstrates the original behaviour and the result after implementation. Record the actual outputs when the checks run.

## Retry and recovery

Explain which steps can be repeated and how to resume if interrupted. For a state-changing operation, describe how to check what completed and how to recover safely.

## Revision history

<Date, author, what changed in the plan and why.>
```
