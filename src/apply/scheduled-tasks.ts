import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { ScheduledTaskConfig } from "../types/config/scheduled-tasks";
import type {
  TaskInfoSchema,
  TaskTriggerInfoSchema,
} from "../types/schema/scheduled-tasks";
import {
  mapTriggerConfigToSchema,
  triggersEqual,
} from "../mappers/scheduled-tasks";

export interface TaskTriggerChange {
  id: string;
  label: string;
  current: TaskTriggerInfoSchema[];
  next: TaskTriggerInfoSchema[];
}

function describe(task: ScheduledTaskConfig): string {
  return [
    ...(task.key ? [`key "${task.key}"`] : []),
    ...(task.name ? [`name "${task.name}"`] : []),
  ].join(" or ");
}

/**
 * Declared tasks replace their whole trigger list; undeclared tasks are not
 * looked at. A task is found by its stable Key, else by its display name.
 */
export function calculateTaskTriggerChanges(
  current: TaskInfoSchema[],
  desired: ScheduledTaskConfig[],
): TaskTriggerChange[] {
  const changes: TaskTriggerChange[] = [];
  const seen: Set<string> = new Set();
  for (const wanted of desired) {
    const task: TaskInfoSchema | undefined =
      current.find((candidate: TaskInfoSchema) =>
        wanted.key ? candidate.Key === wanted.key : false,
      ) ??
      current.find((candidate: TaskInfoSchema) =>
        wanted.name ? candidate.Name === wanted.name : false,
      );
    if (!task?.Id) {
      const keys: string = current
        .flatMap((candidate: TaskInfoSchema) =>
          candidate.Key ? [candidate.Key] : [],
        )
        .sort()
        .join(", ");
      throw new Error(
        `scheduledTasks: no task with ${describe(wanted)}; valid keys: ${keys}`,
      );
    }
    if (seen.has(task.Id)) {
      throw new Error(
        `scheduledTasks: ${describe(wanted)} declares task "${task.Name ?? task.Id}" more than once`,
      );
    }
    seen.add(task.Id);
    const next: TaskTriggerInfoSchema[] = wanted.triggers.map(
      mapTriggerConfigToSchema,
    );
    if (triggersEqual(task.Triggers, next)) continue;
    changes.push({
      id: task.Id,
      label: `scheduled task ${task.Key ?? task.Name ?? task.Id}.triggers`,
      current: task.Triggers ?? [],
      next,
    });
  }
  return changes;
}

export async function applyTaskTriggerChanges(
  client: JellyfinClient,
  changes: TaskTriggerChange[],
): Promise<void> {
  for (const change of changes) {
    logger.info(`Setting triggers: ${change.label}`);
    await client.updateTaskTriggers(change.id, change.next);
  }
}
